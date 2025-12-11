"use client";

import { useFormStatus } from "react-dom";
import React from "react"; // Import React to access useActionState

import { createStore } from "@/app/actions/store";

const initialState = {
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
      aria-disabled={pending}
    >
      {pending ? "Creating..." : "Create Store"}
    </button>
  );
}

export default function StoreForm() {
  const [state, formAction] = React.useActionState(createStore, initialState);

  return (
    <form
      action={formAction}
      className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4"
    >
      <h3 className="text-lg font-semibold text-gray-900">Create New Store</h3>
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Name
        </label>
        <input
          id="name"
          name="name"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <div>
        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
          Address
        </label>
        <input
          id="address"
          name="address"
          type="text"
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          required
        />
      </div>
      <SubmitButton />
      <p aria-live="polite" className="sr-only" role="status">
        {state?.message}
      </p>
    </form>
  );
}
