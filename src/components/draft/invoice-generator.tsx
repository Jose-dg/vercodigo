"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Trash2, Plus, Printer } from "lucide-react"

interface LineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export default function InvoiceGenerator() {
  const [companyName, setCompanyName] = useState("ACME Corporation")
  const [companyEmail, setCompanyEmail] = useState("hello@acmecorp.com")
  const [companyPhone, setCompanyPhone] = useState("+1 (555) 123-4567")
  const [companyAddress, setCompanyAddress] = useState("123 Business St, Suite 100\nSan Francisco, CA 94102")

  const [invoiceNumber, setInvoiceNumber] = useState("INV-001")
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])

  const [clientName, setClientName] = useState("Client Name")
  const [clientEmail, setClientEmail] = useState("client@example.com")
  const [clientAddress, setClientAddress] = useState("456 Client Ave\nNew York, NY 10001")

  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: "1", description: "Professional Services", quantity: 10, unitPrice: 150 },
    { id: "2", description: "Consulting Hours", quantity: 5, unitPrice: 200 },
  ])

  const [taxRate, setTaxRate] = useState(10)

  const addLineItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      description: "",
      quantity: 1,
      unitPrice: 0,
    }
    setLineItems([...lineItems, newItem])
  }

  const removeLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((item) => item.id !== id))
    }
  }

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const calculateLineTotal = (item: LineItem) => item.quantity * item.unitPrice

  const subtotal = lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0)
  const taxAmount = (subtotal * taxRate) / 100
  const total = subtotal + taxAmount

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12">
      {/* Print Button */}
      {/* <div className="mb-6 print:hidden">
        <Button onClick={handlePrint} variant="outline" className="gap-2 bg-transparent">
          <Printer className="h-4 w-4" />
          Print Invoice
        </Button>
      </div> */}

      {/* Invoice Container */}
      <div className="bg-white rounded-lg shadow-lg border border-border overflow-hidden">
        {/* Header Section */}
        <div className="bg-primary text-primary-foreground p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-start gap-4 mb-4">
                <div className="h-12 w-12 bg-white/10 rounded-lg flex items-center justify-center text-2xl font-bold">
                  {companyName.charAt(0)}
                </div>
                <div className="flex-1">
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="text-2xl font-bold bg-transparent border-none text-primary-foreground p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 print:border-none"
                  />
                </div>
              </div>
              <div className="space-y-2 text-primary-foreground/90">
                <Input
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="bg-transparent border-none text-sm p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90"
                />
                <Input
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="bg-transparent border-none text-sm p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90"
                />
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="bg-transparent border-none text-sm p-0 w-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90 font-sans"
                  rows={2}
                />
              </div>
            </div>

            <div className="text-right space-y-4">
              <h1 className="text-4xl md:text-5xl font-bold mb-6">INVOICE</h1>
              <div className="space-y-3">
                <div className="flex justify-end items-center gap-3">
                  <span className="text-sm font-medium text-primary-foreground/80">Invoice #</span>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9 text-right"
                  />
                </div>
                <div className="flex justify-end items-center gap-3">
                  <span className="text-sm font-medium text-primary-foreground/80">Date</span>
                  <Input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9"
                  />
                </div>
                <div className="flex justify-end items-center gap-3">
                  <span className="text-sm font-medium text-primary-foreground/80">Due Date</span>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bill To Section */}
        {/* <div className="p-8 md:p-12 border-b border-border">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bill To</div>
              <div className="space-y-2">
                <Input
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="font-semibold text-lg border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <Input
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="text-sm text-muted-foreground border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <textarea
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  className="text-sm text-muted-foreground border-none p-0 w-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 font-sans"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div> */}

        {/* Line Items Table */}
        <div className="p-8 md:p-12">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-primary">
                  <th className="text-left py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider" colSpan={3}>
                    Description
                  </th>
                  <th className="text-right py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider w-32">
                    Amount
                  </th>
                  <th className="w-12 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, index) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="py-4 px-2" colSpan={3}>
                      <div className="space-y-1">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
                          placeholder="Item description"
                          className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 font-medium"
                        />
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
                            className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-12 text-muted-foreground"
                          />
                          <span>x</span>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => updateLineItem(item.id, "unitPrice", Number.parseFloat(e.target.value) || 0)}
                            className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-24 text-muted-foreground"
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-2 text-right font-medium align-top">{formatCurrency(calculateLineTotal(item))}</td>
                    <td className="py-4 px-2 print:hidden align-top">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        disabled={lineItems.length === 1}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Item Button */}
          <div className="mt-4 print:hidden">
            <Button onClick={addLineItem} variant="outline" className="gap-2 bg-transparent">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </div>

          {/* Totals Section */}
          <div className="mt-12 flex justify-end">
            <div className="w-full max-w-sm space-y-3">
              <div className="flex justify-between items-center py-3 border-b border-border">
                <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                <span className="text-lg font-semibold">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-b border-border">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">Tax Rate</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
                    className="w-20 h-8 text-right"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <span className="text-lg font-semibold">{formatCurrency(taxAmount)}</span>
              </div>

              <div className="flex justify-between items-center py-4 bg-primary/5 px-4 rounded-lg">
                <span className="text-base font-bold text-foreground">Total</span>
                <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/30 p-8 md:p-12 border-t border-border">
          <div className="text-center text-sm text-muted-foreground">
            <p className="font-medium mb-1">Thank you for your business!</p>
            <p>
              Por favor realiza el pago tan pronto como sea posible.{" "}
              {/* {Math.ceil((new Date(dueDate).getTime() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24))} days */}
              {/* of receiving this invoice. */}
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            margin: 0.5in;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          input, textarea {
            border: none !important;
            background: transparent !important;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}


// "use client"

// import { useState } from "react"
// import { Button } from "@/components/ui/button"
// import { Input } from "@/components/ui/input"
// import { Trash2, Plus, Printer } from "lucide-react"

// interface LineItem {
//   id: string
//   description: string
//   quantity: number
//   unitPrice: number
// }

// export function InvoiceGenerator() {
//   const [companyName, setCompanyName] = useState("ACME Corporation")
//   const [companyEmail, setCompanyEmail] = useState("hello@acmecorp.com")
//   const [companyPhone, setCompanyPhone] = useState("+1 (555) 123-4567")
//   const [companyAddress, setCompanyAddress] = useState("123 Business St, Suite 100\nSan Francisco, CA 94102")

//   const [invoiceNumber, setInvoiceNumber] = useState("INV-001")
//   const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0])
//   const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0])

//   const [clientName, setClientName] = useState("Client Name")
//   const [clientEmail, setClientEmail] = useState("client@example.com")
//   const [clientAddress, setClientAddress] = useState("456 Client Ave\nNew York, NY 10001")

//   const [lineItems, setLineItems] = useState<LineItem[]>([
//     { id: "1", description: "Professional Services", quantity: 10, unitPrice: 150 },
//     { id: "2", description: "Consulting Hours", quantity: 5, unitPrice: 200 },
//   ])

//   const [taxRate, setTaxRate] = useState(10)

//   const addLineItem = () => {
//     const newItem: LineItem = {
//       id: Date.now().toString(),
//       description: "",
//       quantity: 1,
//       unitPrice: 0,
//     }
//     setLineItems([...lineItems, newItem])
//   }

//   const removeLineItem = (id: string) => {
//     if (lineItems.length > 1) {
//       setLineItems(lineItems.filter((item) => item.id !== id))
//     }
//   }

//   const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
//     setLineItems(lineItems.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
//   }

//   const formatCurrency = (amount: number) => {
//     return new Intl.NumberFormat("en-US", {
//       style: "currency",
//       currency: "USD",
//     }).format(amount)
//   }

//   const calculateLineTotal = (item: LineItem) => item.quantity * item.unitPrice

//   const subtotal = lineItems.reduce((sum, item) => sum + calculateLineTotal(item), 0)
//   const taxAmount = (subtotal * taxRate) / 100
//   const total = subtotal + taxAmount

//   const handlePrint = () => {
//     window.print()
//   }

//   return (
//     <div className="max-w-5xl mx-auto p-6 md:p-12">
//       {/* Print Button */}
//       <div className="mb-6 print:hidden">
//         <Button onClick={handlePrint} variant="outline" className="gap-2 bg-transparent">
//           <Printer className="h-4 w-4" />
//           Print Invoice
//         </Button>
//       </div>

//       {/* Invoice Container */}
//       <div className="bg-white rounded-lg shadow-lg border border-border overflow-hidden">
//         {/* Header Section */}
//         <div className="bg-primary text-primary-foreground p-8 md:p-12">
//           <div className="grid md:grid-cols-2 gap-8">
//             <div>
//               <div className="flex items-start gap-4 mb-4">
//                 <div className="h-12 w-12 bg-white/10 rounded-lg flex items-center justify-center text-2xl font-bold">
//                   {companyName.charAt(0)}
//                 </div>
//                 <div className="flex-1">
//                   <Input
//                     value={companyName}
//                     onChange={(e) => setCompanyName(e.target.value)}
//                     className="text-2xl font-bold bg-transparent border-none text-primary-foreground p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 print:border-none"
//                   />
//                 </div>
//               </div>
//               <div className="space-y-2 text-primary-foreground/90">
//                 <Input
//                   value={companyEmail}
//                   onChange={(e) => setCompanyEmail(e.target.value)}
//                   className="bg-transparent border-none text-sm p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90"
//                 />
//                 <Input
//                   value={companyPhone}
//                   onChange={(e) => setCompanyPhone(e.target.value)}
//                   className="bg-transparent border-none text-sm p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90"
//                 />
//                 <textarea
//                   value={companyAddress}
//                   onChange={(e) => setCompanyAddress(e.target.value)}
//                   className="bg-transparent border-none text-sm p-0 w-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-primary-foreground/90 font-sans"
//                   rows={2}
//                 />
//               </div>
//             </div>

//             <div className="text-right space-y-4">
//               <h1 className="text-4xl md:text-5xl font-bold mb-6">INVOICE</h1>
//               <div className="space-y-3">
//                 <div className="flex justify-end items-center gap-3">
//                   <span className="text-sm font-medium text-primary-foreground/80">Invoice #</span>
//                   <Input
//                     value={invoiceNumber}
//                     onChange={(e) => setInvoiceNumber(e.target.value)}
//                     className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9 text-right"
//                   />
//                 </div>
//                 <div className="flex justify-end items-center gap-3">
//                   <span className="text-sm font-medium text-primary-foreground/80">Date</span>
//                   <Input
//                     type="date"
//                     value={invoiceDate}
//                     onChange={(e) => setInvoiceDate(e.target.value)}
//                     className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9"
//                   />
//                 </div>
//                 <div className="flex justify-end items-center gap-3">
//                   <span className="text-sm font-medium text-primary-foreground/80">Due Date</span>
//                   <Input
//                     type="date"
//                     value={dueDate}
//                     onChange={(e) => setDueDate(e.target.value)}
//                     className="bg-white/10 border-white/20 text-primary-foreground w-40 h-9"
//                   />
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Bill To Section */}
//         <div className="p-8 md:p-12 border-b border-border">
//           <div className="grid md:grid-cols-2 gap-8">
//             <div>
//               <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Bill To</div>
//               <div className="space-y-2">
//                 <Input
//                   value={clientName}
//                   onChange={(e) => setClientName(e.target.value)}
//                   className="font-semibold text-lg border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
//                 />
//                 <Input
//                   value={clientEmail}
//                   onChange={(e) => setClientEmail(e.target.value)}
//                   className="text-sm text-muted-foreground border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
//                 />
//                 <textarea
//                   value={clientAddress}
//                   onChange={(e) => setClientAddress(e.target.value)}
//                   className="text-sm text-muted-foreground border-none p-0 w-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 font-sans"
//                   rows={2}
//                 />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Line Items Table */}
//         <div className="p-8 md:p-12">
//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead>
//                 <tr className="border-b-2 border-primary">
//                   <th className="text-left py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider">
//                     Description
//                   </th>
//                   <th className="text-center py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider w-24">
//                     Qty
//                   </th>
//                   <th className="text-right py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider w-32">
//                     Unit Price
//                   </th>
//                   <th className="text-right py-4 px-2 text-sm font-semibold text-foreground uppercase tracking-wider w-32">
//                     Amount
//                   </th>
//                   <th className="w-12 print:hidden"></th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {lineItems.map((item, index) => (
//                   <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
//                     <td className="py-4 px-2">
//                       <Input
//                         value={item.description}
//                         onChange={(e) => updateLineItem(item.id, "description", e.target.value)}
//                         placeholder="Item description"
//                         className="border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
//                       />
//                     </td>
//                     <td className="py-4 px-2">
//                       <Input
//                         type="number"
//                         min="1"
//                         value={item.quantity}
//                         onChange={(e) => updateLineItem(item.id, "quantity", Number.parseFloat(e.target.value) || 0)}
//                         className="text-center border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
//                       />
//                     </td>
//                     <td className="py-4 px-2">
//                       <Input
//                         type="number"
//                         min="0"
//                         step="0.01"
//                         value={item.unitPrice}
//                         onChange={(e) => updateLineItem(item.id, "unitPrice", Number.parseFloat(e.target.value) || 0)}
//                         className="text-right border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0 w-full"
//                       />
//                     </td>
//                     <td className="py-4 px-2 text-right font-medium">{formatCurrency(calculateLineTotal(item))}</td>
//                     <td className="py-4 px-2 print:hidden">
//                       <Button
//                         variant="ghost"
//                         size="icon"
//                         onClick={() => removeLineItem(item.id)}
//                         disabled={lineItems.length === 1}
//                         className="h-8 w-8 text-muted-foreground hover:text-destructive"
//                       >
//                         <Trash2 className="h-4 w-4" />
//                       </Button>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           </div>

//           {/* Add Item Button */}
//           <div className="mt-4 print:hidden">
//             <Button onClick={addLineItem} variant="outline" className="gap-2 bg-transparent">
//               <Plus className="h-4 w-4" />
//               Add Item
//             </Button>
//           </div>

//           {/* Totals Section */}
//           <div className="mt-12 flex justify-end">
//             <div className="w-full max-w-sm space-y-3">
//               <div className="flex justify-between items-center py-3 border-b border-border">
//                 <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
//                 <span className="text-lg font-semibold">{formatCurrency(subtotal)}</span>
//               </div>

//               <div className="flex justify-between items-center py-3 border-b border-border">
//                 <div className="flex items-center gap-3">
//                   <span className="text-sm font-medium text-muted-foreground">Tax Rate</span>
//                   <Input
//                     type="number"
//                     min="0"
//                     max="100"
//                     step="0.1"
//                     value={taxRate}
//                     onChange={(e) => setTaxRate(Number.parseFloat(e.target.value) || 0)}
//                     className="w-20 h-8 text-right"
//                   />
//                   <span className="text-sm text-muted-foreground">%</span>
//                 </div>
//                 <span className="text-lg font-semibold">{formatCurrency(taxAmount)}</span>
//               </div>

//               <div className="flex justify-between items-center py-4 bg-primary/5 px-4 rounded-lg">
//                 <span className="text-base font-bold text-foreground">Total</span>
//                 <span className="text-2xl font-bold text-primary">{formatCurrency(total)}</span>
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Footer */}
//         <div className="bg-muted/30 p-8 md:p-12 border-t border-border">
//           <div className="text-center text-sm text-muted-foreground">
//             <p className="font-medium mb-1">Thank you for your business!</p>
//             <p>
//               Please make payment within{" "}
//               {Math.ceil((new Date(dueDate).getTime() - new Date(invoiceDate).getTime()) / (1000 * 60 * 60 * 24))} days
//               of receiving this invoice.
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Print Styles */}
//       <style jsx global>{`
//         @media print {
//           @page {
//             margin: 0.5in;
//           }
//           body {
//             print-color-adjust: exact;
//             -webkit-print-color-adjust: exact;
//           }
//           .print\\:hidden {
//             display: none !important;
//           }
//           input, textarea {
//             border: none !important;
//             background: transparent !important;
//           }
//           button {
//             display: none !important;
//           }
//         }
//       `}</style>
//     </div>
//   )
// }
