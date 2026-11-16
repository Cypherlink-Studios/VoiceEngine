import { useState, useEffect } from 'react';
import { PublicFixedChannel } from '../layout/BrandProvider.js';
import { Radio, Users, Volume2, Shield, Lock, Plus, LogOut, Copy, Check, UserMinus, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { ChannelMember, RoomMember } from '../../net/VoiceSignaling.js';
import { useTranslation } from '../../i18n/index.js';

export interface ActiveRoomState {
  roomId: string;
  pin: string;
  ownerUuid: string;
  members: RoomMember[];
}

export interface RoomErrorState {
  error: string;
  message: string;
  retryAfterSeconds?: number;
}

interface ChannelDrawerProps {
  activeChannel: string;
  fixedChannels: PublicFixedChannel[];
  channelMembers: ChannelMember[];
  proximityPeersCount: number;
  activeRoom?: ActiveRoomState | null;
  roomError?: RoomErrorState | null;
  localPlayerUuid?: string;
  streamerMode?: boolean;
  onSelectChannel: (channelId: string) => void;
  onMemberClick?: (member: ChannelMember | RoomMember) => void;
  onCreateRoom?: () => void;
  onJoinRoom?: (pin: string) => void;
  onLeaveRoom?: () => void;
  onKickMember?: (targetUuid: string) => void;
}

export function ChannelDrawer({
  activeChannel,
  fixedChannels,
  channelMembers,
  proximityPeersCount,
  activeRoom,
  roomError,
  localPlayerUuid,
  streamerMode = false,
  onSelectChannel,
  onMemberClick,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onKickMember,
}: ChannelDrawerProps) {
  const { t } = useTranslation();
  const [pinInput, setPinInput] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [revealPin, setRevealPin] = useState(false);

  useEffect(() => {
    setRevealPin(false);
  }, [activeRoom?.roomId, streamerMode]);

  const isPinMasked = streamerMode && !revealPin;

  const isInRoom = activeChannel.startsWith('room_');
  const isOwner = Boolean(activeRoom && localPlayerUuid && activeRoom.ownerUuid === localPlayerUuid);

  const handleCopyPin = (pin: string) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(pin).then(() => {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      }).catch(() => {});
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim().length === 6) {
      onJoinRoom?.(pinInput.trim());
      setPinInput('');
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full max-w-md bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/10 p-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>{t('channels.title')}</span>
        </div>
        <span className="text-[11px] text-slate-400">{t('channels.switchHint')}</span>
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
              <span>{t('channels.proximityTitle')}</span>
              {activeChannel === 'proximity' && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {t('channels.activeBadge')}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">{t('channels.proximityDesc')}</div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono bg-slate-950/60 px-2 py-1 rounded-md border border-white/5">
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          <span>{proximityPeersCount}</span>
        </div>
      </div>

      {/* Temporary Private Rooms Section */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-amber-400">
            <Lock className="w-3.5 h-3.5" />
            <span>{t('rooms.title')}</span>
          </div>
          {!isInRoom && onCreateRoom && (
            <button
              onClick={onCreateRoom}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{t('rooms.createButton')}</span>
            </button>
          )}
        </div>

        {isInRoom && activeRoom ? (
          /* Active Room View */
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {t('rooms.activeRoomTitle', { pin: isPinMasked ? '••••••' : activeRoom.pin })}
                </span>
                {streamerMode && (
                  <button
                    onClick={() => setRevealPin((prev) => !prev)}
                    className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title={revealPin ? t('rooms.hidePin') : t('rooms.showPin')}
                  >
                    {revealPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  onClick={() => handleCopyPin(activeRoom.pin)}
                  className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title={t('rooms.copyPin')}
                >
                  {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                {copiedPin && (
                  <span className="text-[10px] text-emerald-400 font-medium">
                    {t('rooms.pinCopied')}
                  </span>
                )}
              </div>

              {onLeaveRoom && (
                <button
                  onClick={onLeaveRoom}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('rooms.leaveButton')}</span>
                </button>
              )}
            </div>

            <div className="text-xs text-amber-300/80">
              {t('rooms.activeRoomDesc')}
            </div>

            {/* Room Members Roster */}
            <div className="pt-2 border-t border-amber-500/20 flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-slate-300">
                {t('rooms.membersTitle', { count: activeRoom.members.length })}
              </span>
              <div className="flex flex-wrap gap-2">
                {activeRoom.members.map((member) => (
                  <div
                    key={member.uuid}
                    onClick={() => onMemberClick?.(member)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/80 border border-white/10 text-xs text-slate-200 cursor-pointer hover:border-white/20 transition-all"
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
                    {member.uuid === activeRoom.ownerUuid && (
                      <span className="px-1 py-0.2 rounded text-[8px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {t('rooms.ownerBadge')}
                      </span>
                    )}
                    {isOwner && member.uuid !== localPlayerUuid && onKickMember && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onKickMember(member.uuid);
                        }}
                        className="ml-1 p-0.5 rounded hover:bg-rose-500/30 text-rose-400 transition-colors cursor-pointer"
                        title={t('rooms.kickTooltip', { user: member.username })}
                      >
                        <UserMinus className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Join Room with 6-digit PIN Input */
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-slate-800/40 border border-white/5">
            <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type={isPinMasked ? 'password' : 'text'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder={t('rooms.pinPlaceholder')}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-lg pl-3 pr-8 py-1.5 text-xs text-white placeholder-slate-500 font-mono tracking-widest text-center focus:outline-none focus:border-amber-400/60"
                />
                {streamerMode && (
                  <button
                    type="button"
                    onClick={() => setRevealPin((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title={revealPin ? t('rooms.hidePin') : t('rooms.showPin')}
                  >
                    {revealPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={pinInput.trim().length !== 6}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 border border-amber-500/30 text-xs font-semibold transition-colors cursor-pointer"
              >
                {t('rooms.joinButton')}
              </button>
            </form>

            {/* Error / Rate Limit Feedback */}
            {roomError && (
              <div className="flex items-start gap-1.5 p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  {roomError.retryAfterSeconds
                    ? t('rooms.rateLimitError', { seconds: roomError.retryAfterSeconds })
                    : roomError.message || t('rooms.invalidPinError')}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Channels (Discord-Style) */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 px-1 pt-1">
          {t('channels.globalRooms')}
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
                          {t('channels.activeBadge')}
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
                      title={t('channels.adjustVolumeTooltip', { user: member.username })}
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
