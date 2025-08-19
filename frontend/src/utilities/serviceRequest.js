// ------------------------------------ START- AJAX OPERATIONS ---------------------------------------------//

export const doAjax = async (sUrl, sMethod, oPayload, rSuccess, rError, oHeaders) => {
  const oParams = getParams(oHeaders);
  sUrl = getUrl(sUrl, oParams);
  switch (sMethod.toLowerCase()) {
    case "post":
      await fetch(sUrl, {
        method: "POST",
        body: JSON.stringify(oPayload),
        headers: oParams.headers,
        mode: "cors",
      })
        // .post(sUrl, oPayload, oParams)
        .then((res) => res.json())
        .then((data) => {
          rSuccess(data);
        })
        .catch((err) => {
          rError(err);
        });
      break;
    case "get":
      await fetch(sUrl, {
        method: "GET",
        headers: oParams.headers,
        mode: "cors",
      })
        // .get(sUrl, oParams)
        .then((res) => res.json())
        .then((data) => {
          rSuccess(data);
        })
        .catch((err) => {
          rError(err);
        });
      break;
  }
};
export const promiseAjax = (sUrl, sMethod, oPayload, oHeaders) => {
  const oParams = getParams(oHeaders);
  sUrl = getUrl(sUrl, oParams);

  switch (sMethod.toLowerCase()) {
    case "post":
      return fetch(sUrl, {
        method: "POST",
        body: JSON.stringify(oPayload),
        headers: oParams.headers,
        mode: "cors",
      });
    case "get":
      return fetch(sUrl, {
        method: "GET",
        headers: oParams.headers,
        mode: "cors",
      });
    case "delete":
      return fetch(sUrl, {
        method: "DELETE",
        headers: oParams.headers,
        mode: "cors",
      });
    case "put":
      return fetch(sUrl, {
        method: "PUT",
        headers: oParams.headers,
        mode: "cors",
      });
    case "patch":
      return fetch(sUrl, {
        method: "PATCH",
        body: JSON.stringify(oPayload),
        headers: oParams.headers,
        mode: "cors",
      });
    default:
      return;
  }
};

export const doAjaxWithoutJson = async (sUrl, sMethod, oPayload, rSuccess, rError, oHeaders) => {
  const oParams = getParams(oHeaders);
  sUrl = getUrl(sUrl, oParams);
  switch (sMethod.toLowerCase()) {
    case "get":
      await fetch(sUrl, {
        method: "GET",
        headers: oParams.headers,
        mode: "cors",
      })
        // .get(sUrl, oParams)
        .then((res) => res.text())
        .then((data) => {
          rSuccess(data);
        })
        .catch((err) => {
          rError(err);
        });
      break;
    default:
    case "post":
      await fetch(sUrl, {
        method: "POST",
        body: JSON.stringify(oPayload),
        headers: oParams.headers,
        mode: "cors",
      })
        .then((res) => res.text())
        .then((data) => {
          rSuccess(data);
        })
        .catch((err) => {
          rError(err);
        });
      break;
  }
};
// ------------------------------------ END - AJAX OPERATIONS ----------------------------------------------//

// ------------------------------------ START - UTILITY FUNCTIONS --------------------------------------------//

const getParams = (oHeaders) => {
  let oParams = {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  };

  if (oHeaders) {
    if (oHeaders === "no-auth") {
      delete oParams.headers.Authorization;
    } else {
      oParams.headers = { ...oParams.headers, ...oHeaders };
    }
  }
  return oParams;
};
const getUrl = (sUrl, oParams) => {
  return sUrl;
};
// ------------------------------------ END - UTILITY FUNCTIONS --------------------------------------------//
