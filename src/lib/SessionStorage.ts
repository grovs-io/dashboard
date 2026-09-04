class SessionStorage {
  static setDateFilter = (date: string): void => {
    sessionStorage.setItem("date_filter", date);
  };

  // The email typed before leaving for an identity provider, restored when the callback lands on /login.
  static setSsoEmail = (email: string): void => {
    sessionStorage.setItem("sso_email", email);
  };

  static takeSsoEmail = (): string | null => {
    const email = sessionStorage.getItem("sso_email");
    sessionStorage.removeItem("sso_email");
    return email;
  };

  static getDateFilter = (): string | null => {
    return sessionStorage.getItem("date_filter");
  };
}

export default SessionStorage;
