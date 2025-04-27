"use client";

import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInButton, UserButton } from "@clerk/clerk-react";
import HCaptcha from "@hcaptcha/react-hcaptcha";
import { useEffect, useMemo, useState } from "react";
import {
  useSessionAction,
  useSessionId,
  useSessionMutation,
  useSessionQuery,
} from "convex-helpers/react/sessions";
import { useLocalStorage } from "usehooks-ts";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

function useCaptchaPassedAnonAuthed(): [boolean, (sessionId: string) => void] {
  const [verifedCaptcha, setVerifedCaptcha] = useLocalStorage(
    "verified-captcha",
    "",
  );
  const sessionId = useSessionId()[0];
  const captchaVerified = useMemo(
    () => verifedCaptcha === sessionId,
    [verifedCaptcha, sessionId],
  );
  return [captchaVerified, setVerifedCaptcha];
}

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-light dark:bg-dark p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
        Anon to Auth Notetaker
        <UserButton />
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Anon to Auth Notetaker</h1>
        <Authenticated>
          <Content />
        </Authenticated>
        <Unauthenticated>
          <SignInWrapper />
          <Content />
        </Unauthenticated>
      </main>
    </>
  );
}

function SignInWrapper() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captchaVerified] = useCaptchaPassedAnonAuthed();
  const [signInVisible, setSignInVisible] = useState(captchaVerified);

  const handleClick = (e: React.MouseEvent) => {
    console.log("clicked", captchaVerified);
    e.preventDefault();
    if (!captchaVerified) {
      setIsModalOpen(true);
    } else {
      setSignInVisible(true);
    }
  };

  return (
    <div className="flex flex-col gap-8 w-96 mx-auto">
      <button
        onClick={handleClick}
        className={`bg-dark dark:bg-light cursor-pointer text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2 ${signInVisible ? "hidden" : ""}`}
      >
        Login with Google
      </button>
      {signInVisible && <SignInForm />}
      <CaptchaModal
        isOpen={isModalOpen}
        onClose={(success) => {
          setIsModalOpen(false);
          if (success) {
            setSignInVisible(true);
          }
        }}
      />
    </div>
  );
}

function SignInForm() {
  return (
    <Card className="w-96 mx-auto">
      <CardHeader>
        <CardTitle>Login with Google</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SignInButton mode="modal">
          <button className="bg-dark dark:bg-light text-light dark:text-dark text-sm px-4 py-2 rounded-md border-2 w-full">
            Login
          </button>
        </SignInButton>
      </CardContent>
    </Card>
  );
}

function CaptchaModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: (success: boolean) => void;
}) {
  const [captchaVerified, setVerifiedCaptcha] = useCaptchaPassedAnonAuthed();
  const loginAnonWithCaptcha = useSessionAction(
    api.util.loginAnonWithCaptcha,
  );
  const sessionId = useSessionId()[0];

  if (!isOpen || captchaVerified) return null;

  const onVerify = async (token: string) => {
    await loginAnonWithCaptcha({ captchaResponse: token });
    setVerifiedCaptcha(sessionId!);
    onClose(true);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold">Please verify you're human</h3>
          <HCaptcha
            sitekey="1794236c-c44c-4c40-8fdc-abbafc78eb6a"
            onVerify={(token) => {
              void onVerify(token);
            }}
          />
          <button
            onClick={() => onClose(false)}
            className="mt-4 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-md"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Content() {
  const [input, setInput] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captchaVerified] = useCaptchaPassedAnonAuthed();
  const { isAuthenticated } = useConvexAuth();
  const canLoadNotes = captchaVerified || isAuthenticated;
  const upgradeAnonUser = useSessionMutation(api.util.upgradeAnonUser);
  const createNote = useSessionMutation(api.notes.createNote);
  const notes =
    useSessionQuery(api.notes.getNotes, canLoadNotes ? {} : "skip") ?? [];

  useEffect(() => {
    if (isAuthenticated) {
      void upgradeAnonUser();
    }
  }, [isAuthenticated, upgradeAnonUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticated || captchaVerified) {
      if (input.trim()) {
        await createNote({ note: input });
        setInput("");
      }
    } else {
      setIsModalOpen(true);
    }
  };

  const onCaptchaClose = (success: boolean) => {
    setIsModalOpen(false);
    if (success && captchaVerified && input.trim()) {
      void createNote({ note: input });
      setInput("");
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="flex flex-row gap-2"
      >
        <input
          name="note"
          type="text"
          placeholder="Save a note..."
          className="flex-1 px-4 py-2 rounded-md border-2 border-slate-200 dark:border-slate-800 bg-light dark:bg-dark"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="bg-dark dark:bg-light text-light dark:text-dark px-4 py-2 rounded-md border-2"
        >
          Save
        </button>
      </form>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {notes.map((note) => (
          <Card key={note._id}>
            <CardContent>{note.note}</CardContent>
          </Card>
        ))}
      </div>
      <CaptchaModal isOpen={isModalOpen} onClose={onCaptchaClose} />
    </div>
  );
}
