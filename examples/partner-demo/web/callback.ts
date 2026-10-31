import { completeConnect } from "@qorelly/tally-embed";

// Popup connect fell back to a redirect (small screen or blocked popup): no opener to report to.
if (window.opener) completeConnect();
else window.location.replace("/");
