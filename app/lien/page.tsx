"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveStoredParticipant } from "@/lib/participant-storage";

type Status = "loading" | "success" | "error";

function MagicLinkConsumer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState("");
  const [participantName, setParticipantName] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Lien invalide.");
      return;
    }

    fetch("/api/participant/magic-link/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "Ce lien n'est plus valide.");
        }
        saveStoredParticipant(data.participant);
        setParticipantName(data.participant.name || "");
        setStatus("success");
        setTimeout(() => router.push("/quiz"), 1800);
      })
      .catch((err) => {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      });
  }, [token, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-navy text-3xl shadow-lg">
          ⁉️
        </div>

        {status === "loading" && (
          <>
            <h1 className="text-2xl font-bold text-navy">Connexion en cours...</h1>
            <p className="mt-1 text-gray-600">Un instant.</p>
          </>
        )}

        {status === "success" && (
          <div className="card mt-6">
            <p className="text-lg font-bold text-navy">
              Te revoilà{participantName ? `, ${participantName}` : ""} !
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Cet appareil est maintenant reconnu. Redirection vers le quiz...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="card mt-6">
            <p className="text-lg font-bold text-navy">Ce lien n&apos;a pas fonctionné</p>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <Link href="/quiz" className="btn-accent mt-5 inline-flex w-full justify-center">
              Continuer
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkConsumer />
    </Suspense>
  );
}
