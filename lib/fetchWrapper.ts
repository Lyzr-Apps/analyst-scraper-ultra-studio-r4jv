const fetchWrapper = async (...args: Parameters<typeof fetch>) => {
  try {
    const response = await fetch(...args);

    // if backend sent a redirect
    if (response.redirected) {
      window.location.href = response.url;
      return;
    }

    const url = typeof args[0] === 'string' ? args[0] : '';
    const isAgentCall = url.includes('/api/agent');

    if (response.status == 404) {
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/html")) {
        const html = await response.text();
        document.open();
        document.write(html);
        document.close();
        return;
      } else if (!isAgentCall) {
        alert("Backend returned Endpoint Not Found.");
      }
    } else if (response.status >= 500) {
      // For agent calls, return the response so callAIAgent handles the error
      // gracefully with inline error messages instead of blocking confirm dialogs
      if (isAgentCall) {
        return response;
      }
      const shouldRefresh = confirm(
        "Backend is not responding. Click OK to refresh.",
      );
      if (shouldRefresh) {
        window.location.reload();
      }
      return;
    }

    return response;
  } catch (error) {
    const url = typeof args[0] === 'string' ? args[0] : '';
    const isAgentCall = url.includes('/api/agent');

    // For agent calls, throw so callAIAgent's catch block handles it gracefully
    if (isAgentCall) {
      throw error;
    }

    const shouldRefresh = confirm(
      "Cannot connect to backend. Click OK to refresh.",
    );
    if (shouldRefresh) {
      window.location.reload();
    }
  }
};

export default fetchWrapper;
