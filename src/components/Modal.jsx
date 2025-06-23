import React, { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';

function Modal({ isOpen, onClose, title, children, footer }) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        {/* The backdrop, rendered as a fixed sibling to the panel container */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50" aria-hidden="true" />
        </Transition.Child>

        {/* Full-screen container to center the panel */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="bg-surface-light dark:bg-surface-dark w-full max-w-md m-4 p-6 rounded-lg shadow-xl" role="document">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title as="h2" className="text-xl font-bold">
                  {title}
                </Dialog.Title>
                <button onClick={onClose} aria-label="Close modal" className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">&times;</button>
              </div>
              
              <Dialog.Description as="div" className="mb-6">
                {children}
              </Dialog.Description>

              <div className="flex justify-end gap-3">
                {footer}
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}

export default Modal;
