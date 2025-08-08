// filename: src/components/HostBankInfoSection.tsx
import React from "react";

type Props = {
  user: any;
  bankName: string;
  accountNumber: string;
  editMode: boolean;
  onBankNameChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAccountNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
};

const bankOptions = [
  { value: "Хаан Банк", label: "Хаан Банк" },
  { value: "Голомт Банк", label: "Голомт Банк" },
  { value: "ХХБанк", label: "Худалдаа Хөгжлийн Банк" },
  { value: "Төрийн Банк", label: "Төрийн Банк" },
  { value: "Капитрон", label: "Капитрон" },
  { value: "ХАС Банк", label: "ХАС Банк" },
  { value: "Чингис Хаан Банк", label: "Чингис Хаан Банк" },
];

export default function HostBankInfoSection({
  user,
  bankName,
  accountNumber,
  editMode,
  onBankNameChange,
  onAccountNumberChange,
}: Props) {
  return (
    <div className="border-t pt-6">
      <h2 className="text-xl font-semibold text-green-700 mb-4">
        🏦 Банкны мэдээлэл
      </h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Банкны нэр:
        </label>
        {editMode ? (
          <select
            value={bankName}
            onChange={onBankNameChange}
            className="w-full border rounded p-2"
          >
            <option value="">-- Сонгох --</option>
            {bankOptions.map((bank) => (
              <option key={bank.value} value={bank.value}>
                {bank.label}
              </option>
            ))}
          </select>
        ) : (
          <p className="text-gray-800">{bankName || "-"}</p>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Дансны дугаар:
        </label>
        {editMode ? (
          <input
            type="text"
            value={accountNumber}
            onChange={onAccountNumberChange}
            className="w-full border rounded p-2"
          />
        ) : (
          <p className="text-gray-800">{accountNumber || "-"}</p>
        )}
      </div>
    </div>
  );
}
