import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import Icon from '../../components/Icon';
import AdminInput from '../../components/admin/AdminInput';
import AdminButton from '../../components/admin/AdminButton';

function TeamManagement({ toast, confirm }) {
  const [teams, setTeams] = useState([]);
  const [teamAdmins, setTeamAdmins] = useState([]);
  const [formState, setFormState] = useState({ teamName: '', fullName: '', adminEmail: '' });
  
  // New state to track which team is being edited
  const [editingTeam, setEditingTeam] = useState(null);

  // Fetch teams (unchanged)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const teamsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => a.teamName.localeCompare(b.teamName));
      setTeams(teamsData);
    });
    return unsubscribe;
  }, []);
  
  // Fetch team admins (unchanged)
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'team_admins'), (snapshot) => {
      const adminsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeamAdmins(adminsData);
    });
    return unsubscribe;
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
      setFormState({ teamName: '', fullName: '', adminEmail: '' });
      setEditingTeam(null);
  };

  const handleEditClick = (team) => {
      setEditingTeam(team);
      setFormState({
          teamName: team.teamName,
          fullName: team.fullName,
          adminEmail: '' // Clear admin email field when editing a team
      });
  };

  // Renamed to handle both create and update
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formState.teamName || !formState.fullName) {
        toast.error("Please provide both a short name and a full name.");
        return;
    }

    const teamId = formState.teamName.toUpperCase();

    try {
        if (editingTeam) {
            // Update existing team
            await updateDoc(doc(db, 'teams', editingTeam.id), {
                fullName: formState.fullName
            });
            toast.success(`Team ${editingTeam.id} has been updated.`);
        } else {
            // Create new team
            await setDoc(doc(db, 'teams', teamId), { 
                teamName: teamId, 
                fullName: formState.fullName 
            });
            toast.success(`Team ${teamId} has been created.`);
        }
        
        // Assign admin if email is provided
        if(formState.adminEmail) {
            await setDoc(doc(db, 'team_admins', formState.adminEmail), { team: teamId });
            toast.success(`Admin ${formState.adminEmail} assigned to ${teamId}.`)
        }

        resetForm();
    } catch (error) {
        toast.error("An error occurred while saving the team.");
        console.error("Team save error:", error);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (await confirm('Are you sure?', `This will delete the team "${teamId}". This does not delete associated swimmers or admins.`)) {
      await deleteDoc(doc(db, 'teams', teamId));
      toast.success(`Team ${teamId} deleted.`);
    }
  };

  const handleDeleteAdmin = async (adminId) => {
      if(await confirm('Are you sure?', `This will revoke admin privileges for "${adminId}".`)) {
          await deleteDoc(doc(db, 'team_admins', adminId));
          toast.success(`Admin ${adminId} removed.`);
      }
  };

  return (
    <>
      <h5 className="font-semibold text-lg">{editingTeam ? `Editing Team: ${editingTeam.teamName}` : 'Create New Team'}</h5>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {editingTeam ? "Update the team's full name below." : "Enter a team's short name, full name, and optionally assign an admin."}
      </p>
      <form onSubmit={handleFormSubmit} className="space-y-4">
        {/* Disable short name input when editing */}
        <AdminInput label="Team Short Name (e.g., WCC)" id="teamName" name="teamName" type="text" value={formState.teamName} onChange={handleInputChange} disabled={!!editingTeam} />
        <AdminInput label="Team Full Name" id="fullName" name="fullName" type="text" value={formState.fullName} onChange={handleInputChange} />
        {/* Hide admin email input when editing a team */}
        {!editingTeam && (
            <AdminInput label="Assign Admin Email (Optional)" id="adminEmail" name="adminEmail" type="email" value={formState.adminEmail} onChange={handleInputChange} />
        )}
        <div className="flex gap-2">
            <AdminButton type="submit">{editingTeam ? 'Update Team' : 'Save Team'}</AdminButton>
            {editingTeam && (
                <AdminButton type="button" variant="secondary" onClick={resetForm}>Cancel</AdminButton>
            )}
        </div>
      </form>

      <hr className="my-6 border-border-light dark:border-border-dark" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h5 className="font-semibold text-lg">Existing Teams</h5>
          <ul className="mt-2 space-y-2">
            {teams.map(team => (
              <li key={team.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                <div>
                    <span className="font-medium">{team.teamName}</span>
                    <p className="text-sm text-gray-500">{team.fullName}</p>
                </div>
                <div className="flex items-center space-x-2">
                    {/* Add the edit button */}
                    <button onClick={() => handleEditClick(team)} className="text-gray-500 hover:text-gray-700" title="Edit Team">
                        <Icon name="pencil-alt" />
                    </button>
                    <button onClick={() => handleDeleteTeam(team.id)} className="text-red-500 hover:text-red-700" title="Delete Team">
                        <Icon name="trash" />
                    </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="font-semibold text-lg">Team Admins</h5>
           <ul className="mt-2 space-y-2">
            {teamAdmins.map(admin => (
              <li key={admin.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                <div>
                    <span className="font-medium">{admin.id}</span>
                    <p className="text-sm text-gray-500">Team: {admin.team}</p>
                </div>
                 <button onClick={() => handleDeleteAdmin(admin.id)} className="text-red-500 hover:text-red-700" title="Delete Admin">
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

export default TeamManagement;
