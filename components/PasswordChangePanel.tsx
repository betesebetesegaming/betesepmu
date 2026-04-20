import React, { useState } from 'react';
import { User } from '../types';

interface PasswordChangePanelProps {
  user: User;
  onChangePassword: (userId: string, oldPass: string, newPass: string) => { success: boolean, message: string };
}

export const PasswordChangePanel: React.FC<PasswordChangePanelProps> = ({ user, onChangePassword }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setIsSuccess(false);

        if (!currentPassword || !newPassword || !confirmPassword) {
            setMessage('Please fill in all fields.');
            return;
        }
        if (newPassword.length < 6) {
            setMessage('New password must be at least 6 characters long.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setMessage('New passwords do not match.');
            return;
        }

        const result = onChangePassword(user.id, currentPassword, newPassword);
        setMessage(result.message);
        setIsSuccess(result.success);

        if(result.success) {
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-betese-dark mb-4">Account Settings</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <h4 className="text-lg font-semibold text-betese-dark">Change Password</h4>
                {message && (
                    <p className={`p-3 rounded-md text-sm ${isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message}
                    </p>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="mt-1 w-full p-2 border border-gray-300 rounded-md"
                        required
                    />
                </div>
                <button type="submit" className="w-full px-4 py-3 bg-betese-green text-white font-bold rounded-lg hover:bg-green-700">
                    Update Password
                </button>
            </form>
        </div>
    );
};