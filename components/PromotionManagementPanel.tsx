
import React, { useState, useEffect } from 'react';
import { Promotion, PromotionRule } from '../types';

interface PromotionManagementPanelProps {
    promotions: Promotion[];
    onToggleStatus: (promoId: string) => void;
    onUpdatePromotion: (promoId: string, newName: string, newRules: PromotionRule[]) => void;
    onMovePromotion: (id: string, direction: 'up' | 'down') => void;
    onCreatePromotion: (name: string, type: 'first-deposit' | 'weekly' | 'special') => void;
    onDeletePromotion: (id: string) => void;
}

const normalizeRules = (rules: PromotionRule[]): PromotionRule[] => {
    const cleaned = rules
        .map(rule => ({
            depositAmount: Number(Number(rule.depositAmount || 0).toFixed(2)),
            bonusAmount: Number(Number(rule.bonusAmount || 0).toFixed(2)),
        }))
        .filter(rule => rule.depositAmount > 0 && rule.bonusAmount > 0);

    const byDeposit = new Map<number, number>();
    cleaned.forEach(rule => {
        const prev = byDeposit.get(rule.depositAmount) || 0;
        if (rule.bonusAmount > prev) byDeposit.set(rule.depositAmount, rule.bonusAmount);
    });

    return Array.from(byDeposit.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([depositAmount, bonusAmount]) => ({ depositAmount, bonusAmount }));
};

const PromotionEditor: React.FC<{ 
    promotion: Promotion; 
    index: number;
    total: number;
    onToggleStatus: (promoId: string) => void;
    onUpdatePromotion: (promoId: string, newName: string, newRules: PromotionRule[]) => void;
    onMove: (id: string, direction: 'up' | 'down') => void;
    onDelete: (id: string) => void;
}> = ({ promotion, index, total, onToggleStatus, onUpdatePromotion, onMove, onDelete }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState<string>(promotion.name);
    const [rules, setRules] = useState<PromotionRule[]>(promotion.rules);
    const [error, setError] = useState<string>('');

    useEffect(() => {
        setRules(promotion.rules);
        setName(promotion.name);
        setError('');
    }, [promotion.rules, promotion.name]);

    const handleRuleChange = (index: number, field: keyof PromotionRule, value: string) => {
        const numericValue = Number(value);
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: Number.isFinite(numericValue) ? numericValue : 0 };
        setRules(newRules);
        if (error) setError('');
    };

    const handleAddRule = () => {
        setRules([...rules, { depositAmount: 0, bonusAmount: 0 }]);
        if (error) setError('');
    };

    const handleDeleteRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
        if (error) setError('');
    };

    const handleSave = () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            setError('Promotion name cannot be empty.');
            return;
        }

        const normalized = normalizeRules(rules);
        if (rules.length > 0 && normalized.length === 0) {
            setError('Rules must have deposit and bonus greater than 0.');
            return;
        }
        if (promotion.type === 'first-deposit' && normalized.length === 0) {
            setError('First-deposit promotion requires at least one bonus rule.');
            return;
        }

        onUpdatePromotion(promotion.id, trimmedName, normalized);
        setIsEditing(false);
        setError('');
    };

    const handleCancel = () => {
        setRules(promotion.rules);
        setName(promotion.name);
        setIsEditing(false);
        setError('');
    }

    return (
        <div className="p-4 border rounded-lg bg-gray-50 flex items-start gap-4">
            {/* Reordering Controls */}
            <div className="flex flex-col gap-1 pt-1">
                 <button 
                    onClick={() => onMove(promotion.id, 'up')} 
                    disabled={index === 0}
                    className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                    title="Move Up"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" /></svg>
                 </button>
                 <span className="text-center text-xs font-bold text-gray-500">{index + 1}</span>
                 <button 
                    onClick={() => onMove(promotion.id, 'down')} 
                    disabled={index === total - 1}
                    className="p-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-30"
                    title="Move Down"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                 </button>
            </div>

            <div className="flex-1">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                    <div className="flex-1">
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="text-lg font-semibold text-betese-dark p-1 border rounded-md w-full"
                            />
                        ) : (
                            <h3 className="text-lg font-semibold text-betese-dark">{promotion.name}</h3>
                        )}
                        <p className="text-sm text-gray-500">Type: {promotion.type}</p>
                    </div>
                    <div className="flex items-center gap-4">
                         <div className="flex items-center">
                            <span className={`mr-3 font-semibold text-sm ${promotion.isActive ? 'text-green-600' : 'text-red-600'}`}>
                                {promotion.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <label htmlFor={`promo-toggle-${promotion.id}`} className="inline-flex relative items-center cursor-pointer">
                                <input type="checkbox" checked={promotion.isActive} onChange={() => onToggleStatus(promotion.id)} id={`promo-toggle-${promotion.id}`} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        {!isEditing ? (
                            <div className="flex gap-2">
                                <button onClick={() => setIsEditing(true)} className="px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">Edit</button>
                                <button onClick={() => {
                                    if (window.confirm(`Delete promotion "${promotion.name}"? This cannot be undone.`)) {
                                        onDelete(promotion.id);
                                    }
                                }} className="p-2 text-red-600 hover:bg-red-100 rounded-lg" title="Delete Promotion">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                 <button onClick={handleCancel} className="px-4 py-2 text-sm bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400">Cancel</button>
                                 <button onClick={handleSave} className="px-4 py-2 text-sm bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700">Save</button>
                            </div>
                        )}
                    </div>
                </div>
                 <div className="space-y-3">
                    <h4 className="font-semibold text-gray-700 text-sm">Bonus Rules (Deposit &rarr; Bonus):</h4>
                    {rules.length > 0 ? rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                           <span className="font-semibold text-gray-600">Deposit:</span>
                           <input 
                                type="number" 
                                value={rule.depositAmount}
                                onChange={(e) => handleRuleChange(index, 'depositAmount', e.target.value)}
                                disabled={!isEditing}
                                className="w-24 p-1 border rounded-md disabled:bg-gray-50"
                                placeholder="Amount"
                            />
                             <span className="font-semibold text-gray-600">Bonus:</span>
                             <input 
                                type="number" 
                                value={rule.bonusAmount}
                                onChange={(e) => handleRuleChange(index, 'bonusAmount', e.target.value)}
                                disabled={!isEditing}
                                className="w-24 p-1 border rounded-md disabled:bg-gray-50"
                                placeholder="Bonus"
                            />
                            {isEditing && (
                                <button onClick={() => handleDeleteRule(index)} className="p-1 text-red-500 hover:bg-red-50 rounded ml-auto" title="Remove Rule">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                </button>
                            )}
                        </div>
                    )) : <p className="text-xs text-gray-500 italic">No bonus rules defined yet.</p>}
                    
                    {isEditing && (
                        <button 
                            onClick={handleAddRule}
                            className="mt-2 text-sm text-blue-600 font-bold hover:text-blue-800 flex items-center gap-1"
                        >
                            <span>+</span> Add New Rule
                        </button>
                    )}
                    {error && (
                        <div className="mt-2 p-2 rounded border border-red-200 bg-red-50 text-xs font-bold text-red-700">
                            {error}
                        </div>
                    )}
                    {!isEditing && rules.length > 1 && (
                        <p className="text-[11px] text-gray-500">Rules are applied by highest matching deposit threshold.</p>
                    )}
                </div>
            </div>
        </div>
    )
}

const NewPromotionForm: React.FC<{ onCreate: (name: string, type: 'first-deposit' | 'weekly' | 'special') => void }> = ({ onCreate }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'first-deposit' | 'weekly' | 'special'>('weekly');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if(!trimmedName) {
            setError('Promotion name is required.');
            return;
        }
        onCreate(trimmedName, type);
        setName('');
        setType('weekly');
        setError('');
    }

    return (
        <form onSubmit={handleSubmit} className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 mt-6">
            <h3 className="font-bold text-betese-dark mb-3">Add New Promotion</h3>
            <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-grow">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Promotion Name</label>
                    <input 
                        type="text" 
                        value={name} 
                        onChange={e => { setName(e.target.value); if (error) setError(''); }}
                        placeholder="e.g., Tuesday Special"
                        className="w-full p-2 border rounded"
                        required
                    />
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select 
                        value={type} 
                        onChange={e => setType(e.target.value as any)}
                        className="w-full p-2 border rounded"
                    >
                        <option value="weekly">Weekly / General</option>
                        <option value="special">Special Event</option>
                        <option value="first-deposit">First Deposit Logic</option>
                    </select>
                </div>
                <button type="submit" className="px-6 py-2 bg-betese-green text-white font-bold rounded hover:bg-green-700">
                    Add
                </button>
            </div>
            {error && (
                <p className="mt-3 text-xs font-bold text-red-600">{error}</p>
            )}
        </form>
    )
}


export const PromotionManagementPanel: React.FC<PromotionManagementPanelProps> = ({ promotions, onToggleStatus, onUpdatePromotion, onMovePromotion, onCreatePromotion, onDeletePromotion }) => {
    const [notice, setNotice] = useState<string>('');
    const [simulatedDeposit, setSimulatedDeposit] = useState<number | ''>('');

    const simulationResult = (() => {
        if (typeof simulatedDeposit !== 'number' || !Number.isFinite(simulatedDeposit) || simulatedDeposit <= 0) {
            return null;
        }

        const activePromotions = promotions.filter(p => p.isActive);
        const matching = activePromotions
            .map(promo => {
                const normalizedRules = normalizeRules(promo.rules || []);
                const matchedRule = [...normalizedRules]
                    .sort((a, b) => b.depositAmount - a.depositAmount)
                    .find(rule => simulatedDeposit >= rule.depositAmount);
                return matchedRule ? { promo, rule: matchedRule } : null;
            })
            .filter(Boolean) as Array<{ promo: Promotion; rule: PromotionRule }>;

        if (matching.length === 0) return { matches: [] as Array<{ promo: Promotion; rule: PromotionRule }> };

        return { matches: matching };
    })();

    const handleCreate = (name: string, type: 'first-deposit' | 'weekly' | 'special') => {
        const sameType = promotions.filter(p => p.type === type).length;
        const duplicateName = promotions.some(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());

        if (duplicateName) {
            setNotice('Promotion name already exists. Please use a different name.');
            return;
        }
        if (type === 'first-deposit' && sameType > 0) {
            setNotice('Only one first-deposit promotion is allowed. Edit the existing one instead.');
            return;
        }

        onCreatePromotion(name.trim(), type);
        setNotice('');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Bonus Promotions Management</h2>
            <p className="text-sm text-gray-600 mb-4">Manage your promotions here. Click <strong>Edit</strong> to add deposit bonus rules (e.g., Deposit 100 &rarr; Get 10 Bonus).</p>
            <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                    <div className="flex-1">
                        <h3 className="text-sm font-black text-blue-800 uppercase mb-1">Bonus Simulation Preview</h3>
                        <p className="text-xs text-blue-700">Enter a deposit amount to preview which active promotion rule will apply.</p>
                    </div>
                    <div className="w-full lg:w-56">
                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Deposit Amount</label>
                        <input
                            type="number"
                            min="1"
                            value={simulatedDeposit}
                            onChange={e => setSimulatedDeposit(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="e.g. 300"
                            className="w-full p-2 border rounded-md bg-white"
                        />
                    </div>
                </div>

                <div className="mt-4">
                    {simulationResult === null ? (
                        <p className="text-xs text-gray-500">Enter an amount to preview matching promotion rules.</p>
                    ) : simulationResult.matches.length === 0 ? (
                        <p className="text-sm font-bold text-red-600">No active promotion rule matches this deposit amount.</p>
                    ) : (
                        <div className="space-y-2">
                            {simulationResult.matches.map(({ promo, rule }) => (
                                <div key={promo.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-blue-200 bg-white p-3">
                                    <div>
                                        <p className="text-sm font-black text-betese-dark">{promo.name}</p>
                                        <p className="text-xs text-gray-500 uppercase">{promo.type}</p>
                                    </div>
                                    <div className="text-sm font-bold text-blue-700">
                                        Deposit {rule.depositAmount.toFixed(0)} GMD {'->'} Bonus {rule.bonusAmount.toFixed(0)} GMD
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            {notice && (
                <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-xs font-bold text-amber-700">
                    {notice}
                </div>
            )}
            <div className="space-y-4">
                {promotions.map((promo, index) => (
                    <PromotionEditor 
                        key={promo.id}
                        index={index}
                        total={promotions.length}
                        promotion={promo}
                        onToggleStatus={onToggleStatus}
                        onUpdatePromotion={onUpdatePromotion}
                        onMove={onMovePromotion}
                        onDelete={onDeletePromotion}
                    />
                ))}
            </div>
            <NewPromotionForm onCreate={handleCreate} />
        </div>
    );
};
