
import React from 'react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] transform transition-all">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-betese-dark text-white rounded-t-xl">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 text-yellow-300" viewBox="0 0 24 24" fill="currentColor"><path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v.756a49.106 49.106 0 019.152 1.857.75.75 0 01-.498 1.416l-.016-.006-.063-.021a47.67 47.67 0 00-1.635-.407l-1.01 8.08A8.959 8.959 0 0119.5 15a8.96 8.96 0 01-1.965-.215l-1.01-8.08a47.67 47.67 0 00-4.525 0l-1.01 8.08A8.96 8.96 0 018.5 15a8.96 8.96 0 01-1.965-.215l-1.01-8.08a47.67 47.67 0 00-1.635.407l-.063.021-.016.006a.75.75 0 11-.498-1.416 49.106 49.106 0 019.152-1.857V3a.75.75 0 01.75-.75zm-4.635 8.773l.81 6.476c.352.09.72.138 1.098.138h.109l.028-.001.028.001h.109c.378 0 .746-.048 1.098-.138l.81-6.476a47.273 47.273 0 00-4.09 0zm8.635 0l.81 6.476c.352.09.72.138 1.098.138h.109l.028-.001.028.001h.109c.378 0 .746-.048 1.098-.138l.81-6.476a47.273 47.273 0 00-4.09 0zm-12.25 7.977a.75.75 0 01.75-.75H12a.75.75 0 010 1.5H4.5a.75.75 0 01-.75-.75zm15 0a.75.75 0 01.75-.75h.008a.75.75 0 010 1.5H19.5a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
            <h2 className="text-2xl font-bold tracking-wide">BETESE — Official Betting Rules</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-gray-300 transition-colors focus:outline-none">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto space-y-8 text-gray-800 bg-gray-50">
            
            {/* Rule 1 */}
            <section>
                <h3 className="text-xl font-bold text-betese-dark mb-3 border-b-2 border-betese-green inline-block pb-1">
                    1. Accuracy of Results & Payouts
                </h3>
                <div className="text-sm md:text-base space-y-2 text-gray-700 leading-relaxed">
                    <p>In the event of any material error in the calculation or display of dividends, odds, reports, or payout results, <strong>BETESE will immediately suspend all payments</strong> until the error is fully corrected.</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>No complaints or claims will be accepted regarding adjustments made after such corrections.</li>
                        <li>Bets that have already been paid will not be recalculated, reversed, or adjusted.</li>
                    </ul>
                </div>
            </section>

            {/* Rule 2 */}
            <section>
                <h3 className="text-xl font-bold text-betese-dark mb-3 border-b-2 border-betese-green inline-block pb-1">
                    2. System or Technical Issues
                </h3>
                <div className="text-sm md:text-base space-y-2 text-gray-700 leading-relaxed">
                    <p>If any technical issue, system malfunction, or data error occurs, BETESE reserves the full right to:</p>
                    <ul className="list-disc pl-5 space-y-1">
                        <li>Correct winnings or losses at any time.</li>
                        <li>Update final results to reflect accurate and verified outcomes.</li>
                    </ul>
                    <p className="font-semibold italic text-gray-900 mt-2">
                        By placing a bet, the customer agrees that all corrections made by BETESE are final, binding, and enforceable.
                    </p>
                </div>
            </section>

            {/* Rule 3 */}
            <section>
                <h3 className="text-xl font-bold text-betese-dark mb-3 border-b-2 border-betese-green inline-block pb-1">
                    3. Age Restrictions
                </h3>
                <div className="flex items-start gap-4 bg-red-50 p-4 rounded-lg border border-red-200">
                    <div className="flex-shrink-0 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center border-2 border-red-800"><span className="text-white font-black text-base leading-none">18+</span></div>
                    <div className="text-sm md:text-base text-gray-700 leading-relaxed">
                        <p className="font-bold text-red-700 mb-1">Betting on BETESE is strictly limited to individuals 18 years and above.</p>
                        <p>Under no circumstances should anyone under the age of 18 place a bet or be sent to place a bet on behalf of others.</p>
                        <p className="mt-2 text-xs text-gray-500 uppercase tracking-wide">BETESE may request age verification at any time.</p>
                    </div>
                </div>
            </section>

             {/* Rule 4 */}
             <section>
                <h3 className="text-xl font-bold text-betese-dark mb-3 border-b-2 border-betese-green inline-block pb-1">
                    4. Acceptance of Terms
                </h3>
                <div className="text-sm md:text-base text-gray-700 leading-relaxed bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <p>By using the BETESE platform, customers acknowledge and accept all rules, conditions, and corrections stated in this notice.</p>
                </div>
            </section>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-white rounded-b-xl flex justify-between items-center">
             <p className="text-xs text-gray-500 italic">Last Updated: November 2025</p>
             <button onClick={onClose} className="px-8 py-3 bg-betese-dark text-white font-bold rounded-lg hover:bg-gray-800 transition-transform transform hover:scale-105 shadow-md">
                I Understand
             </button>
        </div>
      </div>
    </div>
  );
};
