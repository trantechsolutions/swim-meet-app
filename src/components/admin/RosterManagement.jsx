import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../../firebase';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import Icon from '../../components/Icon';
import AdminInput from '../../components/admin/AdminInput';
import AdminButton from '../../components/admin/AdminButton';
import AdminSelect from '../../components/admin/AdminSelect';

function RosterManagement({ adminRole, isSuperAdmin, toast, confirm }) {
    const [teams, setTeams] = useState([]);
    const [managingTeam, setManagingTeam] = useState(isSuperAdmin ? "" : adminRole);
    const [roster, setRoster] = useState([]);
    const [swimmerForm, setSwimmerForm] = useState({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });
    const fileInputRef = useRef(null);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
          setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (managingTeam) {
            const unsubscribe = onSnapshot(doc(db, 'rosters', managingTeam), (docSnap) => {
                setRoster(docSnap.exists() ? docSnap.data().swimmers || [] : []);
            });
            return unsubscribe;
        } else {
            setRoster([]);
        }
    }, [managingTeam]);
    
    const resetForm = () => setSwimmerForm({ id: null, firstName: "", lastName: "", age: "", gender: "Boy" });

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const { id, firstName, lastName, age, gender } = swimmerForm;
        if (!firstName.trim() || !lastName.trim() || !age || !managingTeam) {
            toast.error("Please select a team and fill out all swimmer fields."); return;
        }
        let newRoster = id ? roster.map(s => s.id === id ? { ...s, firstName, lastName, age: parseInt(age), gender } : s)
                          : [...roster, { id: crypto.randomUUID(), firstName, lastName, age: parseInt(age), gender }];
        
        await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster }, { merge: true });
        toast.success(`Swimmer ${id ? 'updated' : 'added'} successfully!`);
        resetForm();
    };

    const handleEditClick = (swimmer) => setSwimmerForm(swimmer);

    const handleRemoveClick = async (swimmerToRemove) => {
        if (await confirm('Are you sure?', `This removes ${swimmerToRemove.firstName} from the team roster. It does NOT remove them from any events they are already entered in.`)) {
            try {
                const newRoster = roster.filter(s => s.id !== swimmerToRemove.id);
                await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster });
                toast.success("Swimmer removed from roster.");
            } catch (error) {
                toast.error("Failed to remove swimmer from roster.");
            }
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            const headers = lines.shift().toLowerCase().split(',').map(h => h.trim());
            if (headers[0] !== 'firstname' || headers[1] !== 'lastname' || headers[2] !== 'age' || headers[3] !== 'gender') {
                toast.error("Invalid CSV headers. Must be: firstName,lastName,age,gender"); return;
            }
            const newSwimmers = lines.map(line => {
                const [firstName, lastName, age, gender] = line.split(',');
                return { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), age: parseInt(age), gender: gender.trim() };
            });
            const newRoster = [...roster, ...newSwimmers];
            await setDoc(doc(db, 'rosters', managingTeam), { swimmers: newRoster }, { merge: true });
            toast.success(`Bulk upload successful! Added ${newSwimmers.length} swimmers.`);
            fileInputRef.current.value = "";
        };
        reader.readAsText(file);
    };

    return (
        <>
            <h5 className="font-semibold text-lg">Manage Team Rosters</h5>
            <p className="text-sm text-gray-500 dark:text-gray-400">Add or view swimmers for a specific team.</p>
            <div className="my-4 space-y-4">
                {isSuperAdmin && (
                    <AdminSelect label="1. Select Team" id="teamSelectRoster" value={managingTeam || ""} onChange={e => setManagingTeam(e.target.value)}>
                        <option value="" disabled>-- Choose a Team --</option>
                        {teams.map(team => <option key={team.id} value={team.id}>{team.fullName}</option>)}
                    </AdminSelect>
                )}
            </div>

            {managingTeam && (
                <>
                    <h6 className="font-semibold mt-6">{swimmerForm.id ? 'Edit Swimmer' : 'Add Swimmer'} to {managingTeam}</h6>
                    <form onSubmit={handleFormSubmit} className="my-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:flex lg:items-end gap-3">
                        <div className="lg:flex-grow"><AdminInput label="First Name" id="swimmerFirstName" type="text" value={swimmerForm.firstName} onChange={e => setSwimmerForm({...swimmerForm, firstName: e.target.value})} /></div>
                        <div className="lg:flex-grow"><AdminInput label="Last Name" id="swimmerLastName" type="text" value={swimmerForm.lastName} onChange={e => setSwimmerForm({...swimmerForm, lastName: e.target.value})} /></div>
                        <div className="lg:w-20"><AdminInput label="Age" id="swimmerAge" type="number" value={swimmerForm.age} onChange={e => setSwimmerForm({...swimmerForm, age: e.target.value})} /></div>
                        <div className="lg:w-28"><AdminSelect label="Gender" id="swimmerGender" value={swimmerForm.gender} onChange={e => setSwimmerForm({...swimmerForm, gender: e.target.value})}>
                            <option value="Boy">Boy</option><option value="Girl">Girl</option>
                         </AdminSelect></div>
                        <div className="flex space-x-2 pt-5 lg:pt-0">
                           <AdminButton type="submit" className="flex-1">{swimmerForm.id ? 'Update' : 'Add'}</AdminButton>
                           {swimmerForm.id && <AdminButton type="button" variant="secondary" onClick={resetForm} className="flex-1">Cancel</AdminButton>}
                        </div>
                    </form>
                     <div className="mt-6">
                         <label htmlFor="csvUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bulk Upload Roster (CSV)</label>
                         <input type="file" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" id="csvUpload" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} />
                         <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Format: firstName,lastName,age,gender (with header row)</p>
                     </div>
                     <hr className="my-6 border-border-light dark:border-border-dark"/>
                     <h6 className="font-semibold text-lg mt-3">Team Roster for {managingTeam}</h6>
                     <ul className="mt-2 space-y-2">
                        {roster.length > 0 ? roster.sort((a,b) => a.lastName.localeCompare(b.lastName)).map(swimmer => (
                            <li key={swimmer.id} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-md flex justify-between items-center">
                                <span className="font-medium">{swimmer.lastName}, {swimmer.firstName} (Age: {swimmer.age}, {swimmer.gender})</span>
                                <div className="flex items-center space-x-2">
                                    <button className="text-gray-500 hover:text-gray-700" onClick={() => handleEditClick(swimmer)}><Icon name="pencil-alt"/></button>
                                    <button className="text-red-500 hover:text-red-700" onClick={() => handleRemoveClick(swimmer)}><Icon name="trash"/></button>
                                </div>
                            </li>
                        )) : <li className="p-3 text-center text-gray-500 dark:text-gray-400">No swimmers on this roster yet.</li>}
                    </ul>
                </>
            )}
        </>
    );
}

export default RosterManagement;
