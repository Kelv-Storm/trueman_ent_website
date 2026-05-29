"use client";
import { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { jsPDF } from "jspdf";

export default function Storefront() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState({ mixture: 0, omapodi: 0 });
  const [isOrdering, setIsOrdering] = useState(false);

  const pricePerTin = 25; // RM25

  const handleCheckout = async () => {
    if (!customerName || !phone) return alert("Please enter your name and phone number.");
    if (cart.mixture === 0 && cart.omapodi === 0) return alert("Please add at least 1 tin.");
    
    setIsOrdering(true);
    const totalAmount = (cart.mixture + cart.omapodi) * pricePerTin;
    
    try {
      const docRef = await addDoc(collection(db, "orders"), {
        customer: customerName,
        phone: phone,
        items: cart,
        total: totalAmount,
        status: "Pending Payment",
        createdAt: serverTimestamp()
      });

      generateInvoice(docRef.id, totalAmount);
      alert("Order placed! Please check the downloaded PDF for payment details.");
      
      setCart({ mixture: 0, omapodi: 0 });
      setCustomerName("");
      setPhone("");
    } catch (e) {
      console.error("Error saving order: ", e);
      alert("Something went wrong. Please try again.");
    } finally {
      setIsOrdering(false);
    }
  };

  const generateInvoice = (orderId, total) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Murukku Mart - Official Invoice", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderId}`, 20, 40);
    doc.text(`Customer: ${customerName} (${phone})`, 20, 50);
    
    doc.text(`Mixture Tins: ${cart.mixture} (RM ${cart.mixture * pricePerTin})`, 20, 70);
    doc.text(`Omapodi Tins: ${cart.omapodi} (RM ${cart.omapodi * pricePerTin})`, 20, 80);
    
    doc.setFontSize(16);
    doc.text(`Total Due: RM ${total}`, 20, 100);
    
    doc.text("Payment Instructions:", 20, 120);
    doc.setFontSize(12);
    doc.text("1. Scan DuitNow QR or Transfer to Maybank: 1642-XXXX-XXXX", 20, 130);
    doc.text(`2. Put Order ID as Reference: ${orderId}`, 20, 140);
    doc.text("3. WhatsApp receipt to 012-3456789", 20, 150);
    
    doc.save(`Murukku_Invoice_${orderId}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h1 className="text-3xl font-black text-orange-600 mb-6">Deepavali Murukku</h1>
        
        <div className="space-y-4 mb-8">
          <input type="text" placeholder="Your Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border p-3 rounded-lg" />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border p-3 rounded-lg" />
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
            <div><h3 className="font-bold">Mixture</h3><p className="text-sm text-gray-500">RM25 / tin</p></div>
            <div className="flex gap-4 items-center">
              <button onClick={() => setCart({...cart, mixture: Math.max(0, cart.mixture - 1)})} className="bg-gray-200 w-8 h-8 rounded-full font-bold">-</button>
              <span className="font-bold w-4 text-center">{cart.mixture}</span>
              <button onClick={() => setCart({...cart, mixture: cart.mixture + 1})} className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full font-bold">+</button>
            </div>
          </div>

          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
            <div><h3 className="font-bold">Omapodi</h3><p className="text-sm text-gray-500">RM25 / tin</p></div>
            <div className="flex gap-4 items-center">
              <button onClick={() => setCart({...cart, omapodi: Math.max(0, cart.omapodi - 1)})} className="bg-gray-200 w-8 h-8 rounded-full font-bold">-</button>
              <span className="font-bold w-4 text-center">{cart.omapodi}</span>
              <button onClick={() => setCart({...cart, omapodi: cart.omapodi + 1})} className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full font-bold">+</button>
            </div>
          </div>
        </div>

        <button onClick={handleCheckout} disabled={isOrdering} className="w-full bg-orange-500 text-white font-bold py-4 rounded-lg shadow-lg">
          {isOrdering ? "Generating Order..." : `Checkout (RM ${(cart.mixture + cart.omapodi) * pricePerTin})`}
        </button>
      </div>
    </div>
  );
}