
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

    useEffect(() => {
        setRules(promotion.rules);
        setName(promotion.name);
    }, [promotion.rules, promotion.name]);

    const handleRuleChange = (index: number, field: keyof PromotionRule, value: string) => {
        const numericValue = parseInt(value, 10) || 0;
        const newRules = [...rules];
        newRules[index] = { ...newRules[index], [field]: numericValue };
        setRules(newRules);
    };

    const handleAddRule = () => {
        setRules([...rules, { depositAmount: 0, bonusAmount: 0 }]);
    };

    const handleDeleteRule = (index: number) => {
        setRules(rules.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        onUpdatePromotion(promotion.id, name, rules);
        setIsEditing(false);
    };

    const handleCancel = () => {
        setRules(promotion.rules);
        setName(promotion.name);
        setIsEditing(false);
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
                                <button onClick={() => onDelete(promotion.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg" title="Delete Promotion">
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
                </div>
            </div>
        </div>
    )
}

const NewPromotionForm: React.FC<{ onCreate: (name: string, type: 'first-deposit' | 'weekly' | 'special') => void }> = ({ onCreate }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'first-deposit' | 'weekly' | 'special'>('weekly');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!name.trim()) return;
        onCreate(name, type);
        setName('');
        setType('weekly');
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
                        onChange={e => setName(e.target.value)}
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
        </form>
    )
}


export const PromotionManagementPanel: React.FC<PromotionManagementPanelProps> = ({ promotions, onToggleStatus, onUpdatePromotion, onMovePromotion, onCreatePromotion, onDeletePromotion }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-betese-dark mb-4">Bonus Promotions Management</h2>
            <p className="text-sm text-gray-600 mb-4">Manage your promotions here. Click <strong>Edit</strong> to add deposit bonus rules (e.g., Deposit 100 &rarr; Get 10 Bonus).</p>
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
            <NewPromotionForm onCreate={onCreatePromotion} />
        </div>
    );
};
