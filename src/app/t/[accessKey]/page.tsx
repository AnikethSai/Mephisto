import { notFound } from 'next/navigation';
import { getTeamByAccessKey } from '@/lib/db';
import { TeamAuthForm } from '@/components/participant/TeamAuthForm';
import { Flame, ShieldAlert } from 'lucide-react';

interface PageProps {
  params: Promise<{
    accessKey: string;
  }>;
}

export default async function TeamGatewayPage({ params }: PageProps) {
  const { accessKey } = await params;

  if (!accessKey) {
    notFound();
  }

  const team = getTeamByAccessKey(accessKey);

  if (!team) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-6 rounded-2xl bg-red-950/30 border border-red-900/60 space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-900/50 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-red-200">Invalid Team Portal</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            This QR code or team access link does not correspond to an active participating team in Mephisto&apos;s Bargain. Please check your physical card or contact an organizer.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-900/20 blur-3xl rounded-full pointer-events-none" />

      <div className="max-w-md w-full relative z-10 p-8 rounded-2xl bg-gradient-to-b from-gray-900/90 to-black/95 border border-red-950/80 shadow-2xl space-y-6">
        <div className="flex justify-center">
          <div className="p-3 rounded-full bg-red-950/60 border border-red-800/40">
            <Flame className="w-8 h-8 text-amber-500 animate-pulse" />
          </div>
        </div>

        <TeamAuthForm
          accessKey={team.access_key}
          teamNumber={team.team_number}
          teamName={team.team_name}
        />
      </div>
    </main>
  );
}
