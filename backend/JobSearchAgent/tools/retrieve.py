"""
Amazon Bedrock Knowledge Base retrieval tool for Strands Agent.

This module provides functionality to perform semantic search against Amazon Bedrock
Knowledge Bases, enabling natural language queries against your organization's documents.
It uses vector-based similarity matching to find relevant information and returns results
ordered by relevance score.

Key Features:
1. Semantic Search:
   • Vector-based similarity matching
   • Relevance scoring (0.0-1.0)
   • Score-based filtering

2. Advanced Configuration:
   • Custom result limits
   • Score thresholds
   • Regional support
   • Multiple knowledge bases

3. Response Format:
   • Sorted by relevance
   • Includes metadata
   • Source tracking
   • Score visibility

Usage with Strands Agent:
```python
from strands import Agent
from strands_tools import retrieve

agent = Agent(tools=[retrieve])

# Basic search with default knowledge base and region
results = agent.tool.retrieve(text="What is the STRANDS SDK?")

# Advanced search with custom parameters
results = agent.tool.retrieve(
    text="deployment steps for production",
    numberOfResults=5,
    score=0.7,
    knowledgeBaseId="custom-kb-id",
    region="us-east-1",
    retrieveFilter={
        "andAll": [
            {"equals": {"key": "category", "value": "security"}},
            {"greaterThan": {"key": "year", "value": "2022"}}
        ]
    }
)
```

See the retrieve function docstring for more details on available parameters and options.
"""

import json
import os
from typing import Any, Dict, List

import boto3
from botocore.config import Config as BotocoreConfig
from strands import tool
from strands.types.tools import ToolResult, ToolUse

# Global storage for current request sources (cleared after each request)
_current_request_sources = []


def is_public_url(url: str) -> bool:
    """Check if URL is a public path (contains public/)"""
    return url and "public/" in url



def filter_results_by_score(results: List[Dict[str, Any]], min_score: float) -> List[Dict[str, Any]]:
    """
    Filter results based on minimum score threshold.

    This function takes the raw results from a knowledge base query and removes
    any items that don't meet the minimum relevance score threshold.

    Args:
        results: List of retrieval results from Bedrock Knowledge Base
        min_score: Minimum score threshold (0.0-1.0). Only results with scores
            greater than or equal to this value will be returned.

    Returns:
        List of filtered results that meet or exceed the score threshold
    """
    return [result for result in results if result.get("score", 0.0) >= min_score]


def extract_urls_from_results(results: List[Dict[str, Any]]) -> List[str]:
    """
    Extract URLs from retrieve results metadata and locations.

    This function extracts all relevant URIs from the retrieve results including:
    - S3 URIs from location.s3Location.uri (only public/ paths)
    - Source URIs from metadata.x-amz-bedrock-kb-source-uri (only public/ paths)
    - Document URIs that look like URLs (only public/ paths)

    Only URLs containing "public/" are returned to the user.

    Args:
        results: List of retrieval results from Bedrock Knowledge Base

    Returns:
        List of unique public URLs found in the results (only public/ paths)
    """
    urls = set()  # Use set to avoid duplicates

    for result in results:
        # Extract from location - S3 URIs are valid sources
        location = result.get("location", {})
        if "s3Location" in location and "uri" in location["s3Location"]:
            uri = location["s3Location"]["uri"]
            if uri.startswith(("s3://", "http://", "https://")) and is_public_url(uri):
                urls.add(uri)

        # Extract from metadata - source URIs
        metadata = result.get("metadata", {})
        source_uri = metadata.get("x-amz-bedrock-kb-source-uri")
        if source_uri and source_uri.startswith(("s3://", "http://", "https://")) and is_public_url(source_uri):
            urls.add(source_uri)

        # Also check customDocumentLocation for any URIs
        if "customDocumentLocation" in location and "id" in location["customDocumentLocation"]:
            doc_id = location["customDocumentLocation"]["id"]
            if doc_id.startswith(("s3://", "http://", "https://")) and is_public_url(doc_id):
                urls.add(doc_id)

    return list(urls)


def get_top_sources_for_current_request(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Get top sources by score for the current request, deduplicated.

    Args:
        limit: Maximum number of sources to return (default: 5)

    Returns:
        List of top sources with their scores, sorted by score descending
    """
    # Sort by score descending and take top limit, deduplicate
    seen_urls = set()
    top_sources = []
    for source in sorted(_current_request_sources, key=lambda x: x["score"], reverse=True):
        if source["url"] not in seen_urls:
            seen_urls.add(source["url"])
            top_sources.append(source)
            if len(top_sources) >= limit:
                break

    return top_sources


def clear_current_request_sources():
    """Clear sources from the current request."""
    global _current_request_sources
    _current_request_sources.clear()


def format_results_for_display(results: List[Dict[str, Any]]) -> str:
    """
    Format retrieval results for readable display.

    This function takes the raw results from a knowledge base query and formats
    them into a human-readable string with scores, document IDs, and content.

    Args:
        results: List of retrieval results from Bedrock Knowledge Base

    Returns:
        Formatted string containing the results in a readable format, including score, document ID, and content.
    """
    if not results:
        return "No results found above score threshold."

    formatted = []
    for result in results:
        # Extract document location - handle both s3Location and customDocumentLocation
        location = result.get("location", {})
        doc_id = "Unknown"
        if "customDocumentLocation" in location:
            doc_id = location["customDocumentLocation"].get("id", "Unknown")
        elif "s3Location" in location:
            # Extract meaningful part from S3 URI
            doc_id = location["s3Location"].get("uri", "")
        score = result.get("score", 0.0)
        formatted.append(f"\nScore: {score:.4f}")
        formatted.append(f"Document ID: {doc_id}")

        content = result.get("content", {})
        if content and isinstance(content.get("text"), str):
            text = content["text"]
            formatted.append(f"Content: {text}\n")

    return "\n".join(formatted)


@tool
def retrieve(
    text: str,
    knowledgeBaseId: str = None,
    numberOfResults: int = 10,
    score: float = 0.4,
    retrieveFilter: dict = None
) -> str:
    """
    Retrieve relevant knowledge from Amazon Bedrock Knowledge Base.

    This tool uses Amazon Bedrock Knowledge Bases to perform semantic search against your
    organization's documents. It returns results sorted by relevance score, with the ability
    to filter results that don't meet a minimum score threshold.

    Args:
        text: The query text to search for in the knowledge base
        knowledgeBaseId: The ID of the knowledge base to query (default: from environment)
        numberOfResults: Maximum number of results to return (default: 10)
        score: Minimum relevance score threshold (default: 0.4)
        retrieveFilter: Optional filter to apply to the retrieval results

    Returns:
        Formatted string containing the retrieved results or error message
    """
    # Get defaults from environment if not provided
    if knowledgeBaseId is None:
        knowledgeBaseId = os.getenv("KNOWLEDGE_BASE_ID")

    region_name = os.getenv("AWS_REGION", "us-west-2")
    if score == 0.4:  # Only override if using default
        score = float(os.getenv("MIN_SCORE", "0.4"))

    print(f"DEBUG: Retrieving from knowledge base {knowledgeBaseId} with query: {text[:100]}...")

    tool_use_id = "auto-generated"  # For direct calls

    try:
        # Use parameters directly instead of extracting from tool_input
        query = text
        number_of_results = numberOfResults
        kb_id = knowledgeBaseId
        min_score = score
        retrieve_filter = retrieveFilter

        # Initialize Bedrock client
        config = BotocoreConfig(user_agent_extra="strands-agents-retrieve")
        bedrock_agent_runtime_client = boto3.client("bedrock-agent-runtime", region_name=region_name, config=config)

        # Default retrieval configuration
        retrieval_config = {"vectorSearchConfiguration": {"numberOfResults": number_of_results}}

        if retrieve_filter:
            try:
                if _validate_filter(retrieve_filter):
                    retrieval_config["vectorSearchConfiguration"]["filter"] = retrieve_filter
            except ValueError as e:
                return f"Filter validation error: {str(e)}"

        # Perform retrieval
        response = bedrock_agent_runtime_client.retrieve(
            retrievalQuery={"text": query}, knowledgeBaseId=kb_id, retrievalConfiguration=retrieval_config
        )

        # Get and filter results
        all_results = response.get("retrievalResults", [])
        filtered_results = filter_results_by_score(all_results, min_score)


        # Extract URLs from results
        extracted_urls = extract_urls_from_results(filtered_results)

        # Format results for display
        formatted_results = format_results_for_display(filtered_results)

        # Create URL array in the format expected by frontend
        import json
        url_array = f"[URL_ARRAY_START]{json.dumps(extracted_urls)}[URL_ARRAY_END]"

        print(f"DEBUG: Found {len(filtered_results)} results, {len(extracted_urls)} URLs: {extracted_urls}")

        # Store URLs and scores for current request
        # Extract scores and associate with URLs (only public URLs)
        for result in filtered_results:
            score = result.get("score", 0.0)
            location = result.get("location", {})

            # Get document ID from location
            doc_id = None
            if "customDocumentLocation" in location:
                doc_id = location["customDocumentLocation"].get("id")
            elif "s3Location" in location:
                doc_id = location["s3Location"].get("uri")

            # Only store if it's a public URL, has a score, and is in extracted_urls
            if score > 0 and doc_id and is_public_url(doc_id) and doc_id in extracted_urls:
                _current_request_sources.append({
                    "url": doc_id,
                    "score": score
                })

        # Create final result string
        result_string = f"Retrieved {len(filtered_results)} results with score >= {min_score}:\n{formatted_results}\n{url_array}"

        # Return formatted results with URL array
        return result_string

    except Exception as e:
        # Return error message
        return f"Error during retrieval: {str(e)}"


# A simple validator to check filter is in valid shape
def _validate_filter(retrieve_filter):
    """Validate the structure of a retrieveFilter."""
    try:
        if not isinstance(retrieve_filter, dict):
            raise ValueError("retrieveFilter must be a dictionary")

        # Valid operators according to AWS Bedrock documentation
        valid_operators = [
            "equals",
            "greaterThan",
            "greaterThanOrEquals",
            "in",
            "lessThan",
            "lessThanOrEquals",
            "listContains",
            "notEquals",
            "notIn",
            "orAll",
            "andAll",
            "startsWith",
            "stringContains",
        ]

        # Validate each operator in the filter
        for key, value in retrieve_filter.items():
            if key not in valid_operators:
                raise ValueError(f"Invalid operator: {key}")

            # Validate operator value structure
            if key in ["orAll", "andAll"]:  # Both orAll and andAll require arrays
                if not isinstance(value, list):
                    raise ValueError(f"Value for '{key}' operator must be a list")
                if len(value) < 2:  # Both require minimum 2 items
                    raise ValueError(f"Value for '{key}' operator must contain at least 2 items")
                for sub_filter in value:
                    _validate_filter(sub_filter)
            else:
                if not isinstance(value, dict):
                    raise ValueError(f"Value for '{key}' operator must be a dictionary")
        return True
    except Exception as e:
        raise Exception(f"Unexpected error while validating retrieve filter: {str(e)}") from e