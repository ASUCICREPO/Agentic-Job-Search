import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './UnsubscribePage.css';
import { SAVE_PROFILE_URL } from '../utils/constants';

const UnsubscribePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [processing, setProcessing] = useState<boolean>(true);
  const [success, setSuccess] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [unsubscribeType, setUnsubscribeType] = useState<string>('');

  useEffect(() => {
    const emailParam = searchParams.get('email');
    const actionParam = searchParams.get('action');
    const categoryParam = searchParams.get('category');

    if (!emailParam || !actionParam) {
      setError('Invalid unsubscribe link. Missing required parameters.');
      setProcessing(false);
      return;
    }

    // Automatically unsubscribe the user
    handleAutoUnsubscribe(emailParam, actionParam, categoryParam);
  }, [searchParams]);

  const handleAutoUnsubscribe = async (userEmail: string, actionType: string, categoryName: string | null) => {
    try {
      // First, fetch the current profile to get preferredJobRole if needed
      let updateData: any = {
        email: userEmail,
      };

      if (actionType === 'all') {
        // Unsubscribe from all notifications
        updateData.optInStatus = false;
        setUnsubscribeType('all notifications');
      } else if (actionType === 'category' && categoryName) {
        // Need to fetch profile first to remove specific category
        const profileResponse = await fetch(`${SAVE_PROFILE_URL}?email=${encodeURIComponent(userEmail)}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          if (profileData.profile && profileData.profile.preferredJobRole) {
            const roles = profileData.profile.preferredJobRole
              .split(',')
              .map((r: string) => r.trim())
              .filter((r: string) => r.toLowerCase() !== categoryName.toLowerCase());
            
            updateData.preferredJobRole = roles.join(', ');
            
            // If no roles left, also set optInStatus to false
            if (roles.length === 0) {
              updateData.optInStatus = false;
            }
          }
        }
        
        const categoryDisplay = categoryName.replace('-', ' ').replace(/_/g, ' ');
        setUnsubscribeType(`${categoryDisplay} notifications`);
      }

      // Send POST request to save-profile Lambda
      const response = await fetch(SAVE_PROFILE_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parsed_data: updateData,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription preferences');
      }

      setSuccess(true);
      setProcessing(false);
    } catch (err) {
      console.error('Error updating subscription:', err);
      setError('Failed to unsubscribe. Please try again or update your preferences from the profile page.');
      setProcessing(false);
    }
  };

  if (processing) {
    return (
      <div className="unsubscribe-page">
        <div className="unsubscribe-container">
          <div className="loading-spinner"></div>
          <p>Processing your unsubscribe request...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="unsubscribe-page">
        <div className="unsubscribe-container success">
          <div className="success-icon">✓</div>
          <h1>Successfully Unsubscribed</h1>
          <p>You have been unsubscribed from {unsubscribeType}.</p>
          <p className="resubscribe-message">
            If you would like to resubscribe, you can update your preferences from the Profile section.
          </p>
          <div className="action-buttons">
            <button onClick={() => navigate('/')} className="primary-button">
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unsubscribe-page">
        <div className="unsubscribe-container error">
          <div className="error-icon">✕</div>
          <h1>Error</h1>
          <p>{error}</p>
          <p className="resubscribe-message">
            You can also update your preferences directly from the Profile section.
          </p>
          <div className="action-buttons">
            <button onClick={() => navigate('/')} className="primary-button">
              Go to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default UnsubscribePage;

