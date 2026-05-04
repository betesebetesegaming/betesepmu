import React, { useState } from 'react';
import { User, Role } from '../types';
import { TableScrollNavigator } from './TableScrollNavigator';

type FilterRole = Role | 'All';

interface RoleFilterProps {
  selectedRole: FilterRole;
  onSelectRole: (role: FilterRole) => void;
}

const roles: FilterRole[] = ['All', 'Admin', 'Supervisor', 'Vendor', 'Customer'];

export const RoleFilter: React.FC<RoleFilterProps> = ({ selectedRole, onSelectRole }) => {
  return (
    <aside className="w-full md:w-56 bg-white p-4 rounded-lg shadow-lg flex-shrink-0">
      <h3 className="text-lg font-bold text-betese-dark mb-4">Filter by Role</h3>
      <ul className="space-y-2">
        {roles.map(role => (
          <li key={role}>
            <button
              onClick={() => onSelectRole(role)}
              className={`w-full text-left px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedRole === role
                  ? 'bg-betese-green text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {role}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

interface UserManagementProps {
    users: User[];
    onToggleLock: (userId: string) => void;
    onAddUser?: (name: string, role: Role, phone?: string, password?: string, correctionPin?: string) => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ users, onToggleLock, onAddUser }) => {
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<Role>('Vendor');
    const [newUserPhone, setNewUserPhone] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [error, setError] = useState('');

    const handleAddUser = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!onAddUser) return;

        if (!newUserName || !newUserPassword) {
            setError('Username and password are required.');
            return;
        }
         if (newUserPassword.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }
        if (newUserRole === 'Customer' && !newUserPhone) {
            setError('Please provide a phone number for the customer.');
            return;
        }

        onAddUser(newUserName, newUserRole, newUserRole === 'Customer' ? newUserPhone : undefined, newUserPassword);
        setNewUserName('');
        setNewUserRole('Vendor');
        setNewUserPhone('');
        setNewUserPassword('');
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-lg">
            {onAddUser && (
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg bg-gray-50">
                    <h3 className="md:col-span-3 text-lg font-semibold text-betese-dark">Create New User Account</h3>
                    {error && <p className="md:col-span-3 text-sm text-red-600 bg-red-100 p-2 rounded-md">{error}</p>}
                    <input 
                        type="text" 
                        placeholder="Full Name / Username" 
                        value={newUserName} 
                        onChange={e => setNewUserName(e.target.value)} 
                        className="p-2 border rounded" 
                        required
                    />
                    <select 
                        value={newUserRole} 
                        onChange={e => setNewUserRole(e.target.value as Role)} 
                        className="p-2 border rounded"
                    >
                        <option value="Vendor">Vendor</option>
                        <option value="Supervisor">Supervisor</option>
                        <option value="Customer">Customer</option>
                    </select>
                     <input
                        type="password"
                        placeholder="Password"
                        value={newUserPassword}
                        onChange={e => setNewUserPassword(e.target.value)}
                        className="p-2 border rounded"
                        required
                    />
                     {newUserRole === 'Customer' && (
                        <input
                            type="tel"
                            placeholder="Phone Number (required for Customers)"
                            value={newUserPhone}
                            onChange={e => setNewUserPhone(e.target.value)}
                            className="p-2 border rounded md:col-span-3"
                            required
                        />
                    )}
                    <button type="submit" className="md:col-span-3 px-4 py-2 bg-betese-green text-white font-semibold rounded-lg hover:bg-green-700">Add User Account</button>
                </form>
            )}

            <h2 className="text-xl font-bold text-betese-dark mb-4">User Account Management</h2>
            <TableScrollNavigator className="overflow-x-auto">
                <table className="min-w-full bg-white text-sm">
                    <thead className="bg-gray-200">
                        <tr>
                            <th className="text-left py-2 px-3">User ID</th>
                            <th className="text-left py-2 px-3">User Name / Phone</th>
                            <th className="text-left py-2 px-3">Role</th>
                            <th className="text-left py-2 px-3">Wallet Balance</th>
                            <th className="text-left py-2 px-3">Created By</th>
                            <th className="text-left py-2 px-3">Status</th>
                            <th className="text-left py-2 px-3">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(user => (
                            <tr key={user.id} className="border-b">
                                <td className="py-2 px-3 text-xs">{user.id}</td>
                                <td className="py-2 px-3">{user.role === 'Customer' ? user.phone : user.name}</td>
                                <td className="py-2 px-3">{user.role}</td>
                                <td className="py-2 px-3">
                                    {user.role === 'Customer' ? `${user.walletBalance?.toFixed(2)} GMD` : 'N/A'}
                                </td>
                                <td className="py-2 px-3">{user.createdByName || 'System'}</td>
                                <td className={`py-2 px-3 font-semibold ${user.isLocked ? 'text-red-500' : 'text-green-600'}`}>
                                    {user.isLocked ? 'Locked' : 'Active'}
                                </td>
                                <td>
                                    {user.role === 'Vendor' && (
                                        <button
                                            onClick={() => onToggleLock(user.id)}
                                            className={`px-3 py-1 text-sm text-white font-semibold rounded-lg ${user.isLocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
                                        >
                                            {user.isLocked ? 'Unlock' : 'Lock'}
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </TableScrollNavigator>
        </div>
    );
};