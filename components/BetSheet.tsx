'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BetSelection, BetTypeOption, Race } from '../types';
import { BET_PRICING } from '../constants';
import { BETTING_CUTOFF_MS } from '../utils';
import { HorseSelector } from './HorseSelector';
import RaceTimerButton from './RaceTimerButton';
import { useLanguage } from '../LanguageContext';

interface BetSheetProps {
  isOpen: boolean;
  onClose: () => void;
  races: Race[];
  effectiveTime: Date;
  onAddToSlip: (selection: Omit<BetSelection, 'cost' | 'multiplier'>) => void;
  initialRaceId?: string | null;
}

type Step = 1 | 2 | 3 | 4;

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const BetSheet: React.FC<BetSheetProps> = ({
  isOpen,
  onClose,
  races,
  effectiveTime,
  onAddToSlip,
  initialRaceId,
}) => {
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>(1);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [selectedBetType, setSelectedBetType] = useState<BetTypeOption | null>(null);
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
  const [xCount, setXCount] = useState<number>(0);
  const [pattern, setPattern] = useState<string[]>([]);
  const [horseSelectorKey, setHorseSelectorKey] = useState(0);
  const [justAdded, setJustAdded] = useState(false);

  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const availableRaces = useMemo(
    () => [...races].filter((r) => r.endDate > effectiveTime).sort((a, b) => a.endDate.getTime() - b.endDate.getTime()),
    [races, effectiveTime],
  );

  // Reset only when the sheet opens — DO NOT depend on availableRaces or it
  // will reset every second when effectiveTime ticks and wipe the user's progress.
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setDragY(0);
    setSelectedBetType(null);
    setSelectedNumbers([]);
    setXCount(0);
    setPattern([]);
    setJustAdded(false);
    setHorseSelectorKey((k) => k + 1);
    const snapshot = [...races]
      .filter((r) => r.endDate > effectiveTime)
      .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
    const target = initialRaceId
      ? snapshot.find((r) => r.id === initialRaceId) ?? snapshot[0] ?? null
      : snapshot[0] ?? null;
    setSelectedRace(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialRaceId]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const timeRemaining = selectedRace ? selectedRace.endDate.getTime() - effectiveTime.getTime() : 0;
  const isBettingClosed = !!selectedRace && timeRemaining <= BETTING_CUTOFF_MS;

  const pricing = selectedBetType ? BET_PRICING[selectedBetType] : null;
  const totalSelected = selectedNumbers.length + xCount;
  const meetsMin = pricing ? totalSelected >= pricing.minHorses : false;

  const previewCost = useMemo(() => {
    if (!pricing) return 0;
    if (xCount > 0 && pricing.xPriceMap) {
      const xRow = pricing.xPriceMap[xCount];
      return xRow ? xRow[selectedNumbers.length] ?? 0 : 0;
    }
    if (pricing.perHorsePrice) {
      return pricing.perHorsePrice * Math.max(1, totalSelected);
    }
    return pricing.priceMap?.[totalSelected] ?? 0;
  }, [pricing, xCount, selectedNumbers.length, totalSelected]);

  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current == null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragY(dy);
  };
  const handleTouchEnd = () => {
    if (dragY > 120) {
      onClose();
    }
    setDragY(0);
    dragStartY.current = null;
  };

  const goNext = () => setStep((s) => (s < 4 ? ((s + 1) as Step) : s));
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  const handleSelectRace = (id: string) => {
    const race = availableRaces.find((r) => r.id === id) || null;
    setSelectedRace(race);
    setSelectedBetType(null);
    setSelectedNumbers([]);
    setXCount(0);
    setPattern([]);
    goNext();
  };

  const handleSelectBetType = (bt: BetTypeOption) => {
    setSelectedBetType(bt);
    setSelectedNumbers([]);
    setXCount(0);
    setPattern([]);
    goNext();
  };

  const handleAddToSlip = () => {
    if (!selectedRace || !selectedBetType) return;
    if (!meetsMin) return;
    if (isBettingClosed) return;
    onAddToSlip({
      raceId: selectedRace.id,
      raceName: selectedRace.name,
      betType: selectedBetType,
      numbers: selectedNumbers,
      xCount,
      pattern,
    });
    // Keep the sheet open: clear horses, bounce back to horse selection so the
    // user can quickly add another bet on the same race/type. Race + bet type
    // are preserved so the flow stays fast.
    setSelectedNumbers([]);
    setXCount(0);
    setPattern([]);
    setHorseSelectorKey((k) => k + 1);
    setStep(3);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  if (!isOpen) return null;

  const stepLabel: Record<Step, string> = {
    1: 'Choose Race',
    2: 'Choose Bet Type',
    3: 'Choose Horses',
    4: 'Review & Confirm',
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      <div
        className="relative w-full sm:max-w-2xl bg-white rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragStartY.current == null ? 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          animation: dragStartY.current == null ? 'sheet-up 320ms cubic-bezier(0.22, 1, 0.36, 1)' : undefined,
        }}
      >
        <div
          className="pt-2 pb-1 flex justify-center cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        </div>

        <div className="px-5 pt-2 pb-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={step > 1 ? goBack : onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              aria-label="Back"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-400">Step {step} of 4</p>
              <h3 className="text-lg font-black text-betese-dark leading-tight">{stepLabel[step]}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={`flex-1 h-1.5 rounded-full transition-colors ${n <= step ? 'bg-betese-green' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
          {step === 1 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">Tap a race to begin. The countdown is the time until betting closes.</p>
              {availableRaces.length === 0 ? (
                <div className="py-12 text-center text-gray-400 font-bold uppercase text-xs">{t('no_races')}</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {availableRaces.map((race) => (
                    <RaceTimerButton
                      key={race.id}
                      race={race}
                      isSelected={selectedRace?.id === race.id}
                      onClick={handleSelectRace}
                      initialEffectiveTime={effectiveTime}
                      variant="customer"
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedRace && (
            <div>
              <div className={`rounded-2xl p-3 mb-4 flex items-center justify-between text-white ${isBettingClosed ? 'bg-red-600' : 'bg-betese-green'}`}>
                <div>
                  <p className="text-[10px] font-black uppercase opacity-90">Race</p>
                  <p className="text-lg font-black leading-none">{selectedRace.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase opacity-90">{isBettingClosed ? 'Status' : 'Closes in'}</p>
                  <p className="text-2xl font-mono font-black leading-none">
                    {isBettingClosed ? 'CLOSED' : formatCountdown(timeRemaining)}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600 mb-3">Choose the bet type you want to play.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.values(BetTypeOption).map((bt) => {
                  const isDisabled = selectedRace.disabledBetTypes?.includes(bt);
                  const isActive = selectedBetType === bt;
                  return (
                    <button
                      key={bt}
                      onClick={() => !isDisabled && handleSelectBetType(bt)}
                      disabled={isDisabled}
                      className={`relative p-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center justify-center h-24 gap-1 border-2 active:scale-95 ${
                        isDisabled
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : isActive
                          ? 'bg-yellow-400 text-betese-dark border-betese-green shadow-lg scale-105'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-yellow-400 shadow-sm'
                      }`}
                    >
                      <span className="text-base">{bt}</span>
                      <span className="text-[10px] font-bold opacity-70">Min {BET_PRICING[bt].minHorses} horses</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && selectedRace && selectedBetType && (
            <div>
              {justAdded && (
                <div className="mb-3 rounded-xl bg-green-50 border-2 border-betese-green p-3 flex items-center gap-2 animate-fade-in">
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-betese-green flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-sm font-black text-betese-dark uppercase tracking-wide">Added to slip! Pick more horses or hit Done.</p>
                </div>
              )}
              <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 mb-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-gray-500">Race</p>
                  <p className="text-sm font-black text-betese-dark">{selectedRace.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase text-gray-500">Bet</p>
                  <p className="text-sm font-black text-betese-dark">{selectedBetType}</p>
                </div>
              </div>
              <HorseSelector
                key={horseSelectorKey}
                race={selectedRace}
                betType={selectedBetType}
                selectedNumbers={selectedNumbers}
                xCount={xCount}
                onNumberSelect={setSelectedNumbers}
                onXSelect={setXCount}
                onPatternChange={setPattern}
                disabled={isBettingClosed}
              />
              <button
                onClick={goNext}
                disabled={!meetsMin || isBettingClosed}
                className="mt-4 w-full py-4 bg-betese-green text-white font-black rounded-2xl shadow-lg disabled:opacity-40 active:scale-95 transition-all uppercase tracking-widest"
              >
                Review Bet
              </button>
              <button
                onClick={onClose}
                className="mt-2 w-full py-3 bg-gray-100 text-gray-700 font-black rounded-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          )}

          {step === 4 && selectedRace && selectedBetType && (
            <div className="space-y-4">
              <div className="rounded-2xl border-2 border-betese-green bg-green-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-betese-green">Review your bet</p>
                <h4 className="text-2xl font-black text-betese-dark mt-1">{selectedRace.name}</h4>
                <p className="text-sm font-bold text-gray-700">{selectedBetType}</p>

                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase text-gray-500 mb-1">Selection</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(pattern.length > 0 ? pattern : [
                      ...Array.from({ length: xCount }).map(() => 'X'),
                      ...selectedNumbers.map(String),
                    ]).map((p, i) => (
                      <span
                        key={i}
                        className={`px-3 py-1.5 rounded-lg font-black text-base border-2 ${
                          p === 'X' ? 'bg-yellow-400 text-black border-yellow-600' : 'bg-betese-dark text-white border-betese-green'
                        }`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-green-200 pt-3">
                  <span className="text-xs font-black uppercase text-gray-500">Base cost</span>
                  <span className="text-3xl font-black text-betese-dark">GMD {previewCost.toFixed(0)}</span>
                </div>
              </div>

              <button
                onClick={handleAddToSlip}
                disabled={!meetsMin || isBettingClosed}
                className="w-full py-5 bg-betese-green text-white font-black rounded-2xl shadow-xl disabled:bg-gray-300 disabled:opacity-50 active:scale-95 transition-all text-xl uppercase tracking-widest"
              >
                {isBettingClosed ? 'Betting Closed' : 'Add to Slip'}
              </button>
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 bg-gray-100 text-gray-700 font-black rounded-xl active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Edit Horses
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes sheet-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
