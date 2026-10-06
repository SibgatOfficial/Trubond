export const BRANCHES = [
  { value: "CSE", label: "Computer Science & Engineering" },
  { value: "CSD", label: "Computer Science & Design" },
  { value: "ECE", label: "Electronics & Communication" },
  { value: "EEE", label: "Electrical & Electronics" },
  { value: "MECH", label: "Mechanical Engineering" },
  { value: "CIVIL", label: "Civil Engineering" },
] as const;

export const GENDERS = ["Male", "Female", "Other", "Prefer not to say"] as const;

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/groups", label: "Groups", icon: "group" },
  { href: "/events", label: "Events", icon: "event" },
  { href: "/projects", label: "Projects", icon: "folder" },
  { href: "/profile", label: "Profile", icon: "account_circle" },
] as const;

export const APP_NAME = "Trubond";
export const APP_TAGLINE = "College Networking App";
