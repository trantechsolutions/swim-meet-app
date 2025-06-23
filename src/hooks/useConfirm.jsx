import React, { useState, useCallback } from 'react';
import Modal from '../components/Modal.jsx';
import AdminButton from '../components/admin/AdminButton.jsx';
import AdminInput from '../components/admin/AdminInput.jsx';

const useConfirm = () => {
  const [promise, setPromise] = useState(null);
  const [content, setContent] = useState(null);

  const confirm = useCallback((contentPayload) => {
    setContent(contentPayload);
    return new Promise((resolve, reject) => {
      setPromise({ resolve });
    });
  }, []);

  const handleClose = () => {
    setPromise(null);
  };

  const handleConfirm = (data) => {
    promise?.resolve(data);
    handleClose();
  };

  const handleCancel = () => {
    promise?.resolve(false);
    handleClose();
  };

  const ConfirmationModal = () => {
    const [formState, setFormState] = useState({});

    const handleInputChange = (e) => {
        setFormState(prev => ({...prev, [e.target.name]: e.target.value}));
    };
    
    // Set initial form state when the modal opens
    useState(() => {
        if (content?.mode === 'form' && content.inputs) {
            const initialState = {};
            content.inputs.forEach(input => {
                initialState[input.name] = input.defaultValue || '';
            });
            setFormState(initialState);
        }
    }, [content]);

    if (!promise) return null;

    const isForm = content.mode === 'form';

    return (
      <Modal
        isOpen={promise !== null}
        onClose={handleClose}
        title={content.title}
        footer={
          <>
            <AdminButton onClick={handleCancel} variant="secondary">
              Cancel
            </AdminButton>
            <AdminButton onClick={() => handleConfirm(isForm ? formState : true)} variant="primary">
              {content.confirmText || 'Confirm'}
            </AdminButton>
          </>
        }
      >
        {isForm ? (
            <div className="space-y-4">
                {content.inputs.map(input => (
                    <AdminInput 
                        key={input.name}
                        label={input.label}
                        id={input.name}
                        name={input.name}
                        type={input.type || 'text'}
                        value={formState[input.name] || ''}
                        onChange={handleInputChange}
                    />
                ))}
            </div>
        ) : (
            <p>{content.message}</p>
        )}
      </Modal>
    );
  };

  return { confirm, ConfirmationModal };
};

export default useConfirm;
