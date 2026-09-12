import { PublicFixedChannel } from '../layout/BrandProvider.js';
import { Radio, Users, Volume2, Shield } from 'lucide-react';
import { ChannelMember } from '../../net/VoiceSignaling.js';

interface ChannelDrawerProps {
  activeChannel: string;
  fixedChannels: PublicFixedChannel[];
  channelMembers: ChannelMember[];
  proximityPeersCount: number;
  onSelectChannel: (channelId: string) => void;
  onMemberClick?: (member: ChannelMember) => void;
}

export function ChannelDrawer({
  activeChannel,
  fixedChannels,
  channelMembers,
  proximityPeersCount,
  onSelectChannel,
  onMemberClick,
}: ChannelDrawerProps) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>Voice Channels</span>
        </div>
        <span className="text-[11px] text-slate-400">Click to switch</span>
      </div>

      {/* Proximity 3D Option */}
      <div
        onClick={() => onSelectChannel('proximity')}
        className={`group relative flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
          activeChannel === 'proximity'
            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
            : 'bg-slate-800/40 border-white/5 hover:bg-slate-800/80 hover:border-white/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeChannel === 'proximity'
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-slate-800 text-slate-400 group-hover:text-white'
            }`}
          >
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-medium text-white flex items-center gap-2">
              <span>Proximity Chat (3D)</span>
              {activeChannel === 'proximity' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Active
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">Positional spatial audio based on in-game coordinates</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950/60 px-2 py-1 rounded-md border border-white/5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>{proximityPeersCount}</span>
        </div>
      </div>

      {/* Fixed Channels (Discord-Style) */}
      <div className="flex flex-col gap-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 px-1 pt-1">
          Global Rooms (Stereo)
        </div>

        {fixedChannels.map((channel) => {
          const isActive = activeChannel === channel.id;
          const isStaff = channel.id.toLowerCase().includes('staff');

          return (
            <div
              key={channel.id}
              onClick={() => onSelectChannel(channel.id)}
              className={`group flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                isActive
                  ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                  : 'bg-slate-800/40 border-white/5 hover:bg-slate-800/80 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive
                        ? 'bg-indigo-500/20 text-indigo-400'
                        : 'bg-slate-800 text-slate-400 group-hover:text-white'
                    }`}
                  >
                    {isStaff ? <Shield className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      <span>{channel.name}</span>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    {channel.description && (
                      <div className="text-xs text-slate-400">{channel.description}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950/60 px-2 py-1 rounded-md border border-white/5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>
                    {isActive ? channelMembers.length : 0}
                    {channel.userLimit > 0 ? `/${channel.userLimit}` : ''}
                  </span>
                </div>
              </div>

              {/* Members in Active Fixed Channel */}
              {isActive && channelMembers.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap gap-2">
                  {channelMembers.map((member) => (
                    <div
                      key={member.uuid}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMemberClick?.(member);
                      }}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900 border border-white/10 hover:border-white/25 text-xs text-slate-200 cursor-pointer transition-colors"
                      title={`Clic para ajustar volumen de ${member.username}`}
                    >
                      <div className="relative">
                        <img
                          src={`https://mc-heads.net/avatar/${member.uuid}/20`}
                          alt={member.username}
                          className={`w-5 h-5 rounded ${
                            member.isSpeaking ? 'ring-2 ring-emerald-400 scale-105' : ''
                          }`}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><rect width="20" height="20" fill="%23475569"/><text x="10" y="14" font-size="10" fill="white" text-anchor="middle">?</text></svg>';
                          }}
                        />
                        {member.isSpeaking && (
                          <span className="absolute -inset-0.5 rounded animate-ping bg-emerald-400/50" />
                        )}
                      </div>
                      <span className="font-medium">{member.username}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
