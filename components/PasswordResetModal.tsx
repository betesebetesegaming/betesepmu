import React, { useState } from 'react';
import { User } from '../types';

interface PasswordResetModalProps {
  user: User;
  onClose: () => void;
  onSave: (newPassword: string) => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({ user, onClose, onSave }) => {
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        onSave(newPassword);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-2xl w-full max-w-md">
                <h2 className="text-2xl font-bold text-betese-dark mb-2">Reset Password</h2>
                <p className="text-gray-600 mb-4">You are setting a new password for user: <strong className="text-betese-dark">{user.name}</strong></p>
                {error && <p className="p-2 mb-2 rounded-md text-sm bg-red-100 text-red-800">{error}</p>}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                            required
                            autoFocus
                        />
                    </div>
                </div>
                <div className="mt-6 flex justify-end gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-300 text-gray-800 font-semibold rounded-lg hover:bg-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-6 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700"
                    >
                        Save New Password
                    </button>
                </div>
            </form>
        </div>
    );
};