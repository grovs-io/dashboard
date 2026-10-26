/** Saves the Google Cloud setup script (Pub/Sub topic, push subscription, service account). */
export function downloadGoogleSetupScript(script: string) {
  const blob = new Blob([script], { type: "application/x-sh" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "grovs_android_gcloud_setup.sh";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
