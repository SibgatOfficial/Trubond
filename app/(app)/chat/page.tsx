"use client";

import { useAuth } from "@/context/auth-provider";
import { ChatClient } from "@/components/chat/chat-client";

export default function ChatPage() {
  const { profile } = useAuth();
  if (!profile) return null;
  return <ChatClient currentUser={profile} />;
}
