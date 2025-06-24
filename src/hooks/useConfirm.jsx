import React, { useState, useCallback } from 'react';
import Modal from '../components/Modal.jsx';
import AdminButton from '../components/admin/AdminButton.jsx';

const useConfirm = () => {
  // Store all options, including the content to render and the promise resolver
  const [options, setOptions] = useState(null);

  // The confirm function now takes a single options object for clarity and power.
  // Example usage: confirm({ title: 'My Title', content: <p>My JSX content</p> })
  const confirm = useCallback((newOptions) => {
    return new Promise((resolve) => {
      setOptions({ ...newOptions, resolve });
    });
  }, []);

  const handleClose = () => {
    setOptions(null);
  };

  const handleConfirm = () => {
    options?.resolve(true);
    handleClose();
  };

  const handleCancel = () => {
    options?.resolve(false);
    handleClose();
  };

  // This is the key change: The Modal's children are now the `content` property
  // passed to the confirm function, which can be any valid React node.
  const ConfirmationModal = () => (
    <Modal
      isOpen={options !== null}
      onClose={handleCancel}
      title={options?.title || 'Confirmation'}
      footer={
        <>
          <AdminButton onClick={handleCancel} variant="secondary">
            {options?.cancelText || 'Cancel'}
          </AdminButton>
          <AdminButton onClick={handleConfirm} variant="primary">
            {options?.confirmText || 'Confirm'}
          </AdminButton>
        </>
      }
    >
      {/* Render the custom content passed into the hook */}
      {options?.content}
    </Modal>
  );

  return { confirm, ConfirmationModal };
};

export default useConfirm;
