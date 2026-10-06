"use client";

import * as React from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatType, UserProfile } from "@/types";
import { createPoll } from "@/lib/services/chat";
import { toast } from "sonner";

export function CreatePollDialog({
  roomType,
  roomId,
  currentUser,
  open,
  onOpenChange,
}: {
  roomType: ChatType;
  roomId: string;
  currentUser: UserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [question, setQuestion] = React.useState("");
  const [options, setOptions] = React.useState(["", ""]);
  const [duration, setDuration] = React.useState("7");
  const [saving, setSaving] = React.useState(false);

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const handleSubmit = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < 2) {
      toast.error("Add a question and at least two options.");
      return;
    }
    setSaving(true);
    try {
      await createPoll(
        roomType,
        roomId,
        currentUser,
        question.trim(),
        cleanOptions,
        Number(duration) || 7
      );
      toast.success("Poll created!");
      setQuestion("");
      setOptions(["", ""]);
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to create poll.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a poll</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="poll-q">Question *</Label>
            <Input
              id="poll-q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="mt-1.5"
              placeholder="Ask a question..."
            />
          </div>

          <div className="space-y-2">
            <Label>Options *</Label>
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Poll option ${index + 1}`}
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < 6 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setOptions((prev) => [...prev, ""])}
              >
                <Plus className="h-4 w-4" /> Add option
              </Button>
            )}
          </div>

          <div>
            <Label htmlFor="poll-duration">Duration (days)</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="poll-duration" className="mt-1.5">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 day</SelectItem>
                <SelectItem value="3">3 days</SelectItem>
                <SelectItem value="7">1 week</SelectItem>
                <SelectItem value="30">1 month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? "Creating..." : "Create Poll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
