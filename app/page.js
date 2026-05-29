"use client";
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { jsPDF } from "jspdf";

const MENU = [
  { id: 'spicy_dhall', name: 'Spicy Dhall', price: 45 },
  { id: 'bombay_mixture', name: 'Bombay Spice Mixture', price: 30 },
  { id: 'kara_bounty', name: 'Kara Bounty', price: 30 },
  { id: 'pagoda', name: 'Pagoda', price: 35 },
  { id: 'pepper_kara_sev', name: 'Pepper Kara Sev', price: 30 },
  { id: 'spicy_banana_chips', name: 'Spicy Banana Chips', price: 45 },
  { id: 'spicy_mixture', name: 'Spicy Mixture', price: 30 },
  { id: 'salted_peanuts', name: 'Salted Peanuts', price: 50 },
  { id: 'green_beans', name: 'Green Beans', price: 45 },
  { id: 'spicy_tapioca_chips', name: 'Spicy Tapioca Chips', price: 30 }
];

export default function Storefront() {
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [cart, setCart] = useState({});
  const [isOrdering, setIsOrdering] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("Loading...");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "storeDetails"), (docSnap) => {
      if (docSnap.exists()) {
        setDeliveryDate(docSnap.data().deliveryDate);
      } else {
        setDeliveryDate("TBA");
      }
    });
    return () => unsub();
  }, []);

  const totalAmount = MENU.reduce((sum, item) => {
    return sum + (cart[item.id] || 0) * item.price;
  }, 0);

  const updateCart = (itemId, amount) => {
    setCart(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + amount)
    }));
  };

  const handleCheckout = async () => {
    if (!customerName || !phone) return alert("Please enter your name and phone number.");
    if (totalAmount === 0) return alert("Please add at least 1 tin to your cart.");
    
    setIsOrdering(true);
    
    const orderItems = {};
    MENU.forEach(item => {
      if (cart[item.id] > 0) orderItems[item.name] = cart[item.id];
    });

    // Generate Custom Order ID: Customer_Name_YYYY/MM/DD
    const dateObj = new Date();
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}/${mm}/${dd}`;
    const customOrderId = `${customerName.trim().replace(/\s+/g, '_')}_${formattedDate}`;

    try {
      await addDoc(collection(db, "orders"), {
        orderId: customOrderId, // Saves the new format to Firebase too!
        customer: customerName,
        phone: phone,
        items: orderItems,
        total: totalAmount,
        status: "Pending Payment",
        createdAt: serverTimestamp()
      });

      // Pass the new custom ID to the PDF generator
      generateInvoice(customOrderId, totalAmount, orderItems);
      alert("Order placed! Please check the downloaded PDF for payment details.");
      
      setCart({});
      setCustomerName("");
      setPhone("");
    } catch (e) {
      console.error(e);
      alert("Error saving order: " + e.message); 
    } finally {
      setIsOrdering(false);
    }
  };

  const generateInvoice = (orderId, total, items) => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Trueman Enterprise - Official Invoice", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderId}`, 20, 40);
    doc.text(`Customer: ${customerName} (${phone})`, 20, 50);
    doc.text(`Delivery Date: ${deliveryDate}`, 20, 60);
    
    let yPos = 80;
    Object.entries(items).forEach(([itemName, qty]) => {
      const itemPrice = MENU.find(m => m.name === itemName).price;
      doc.text(`${itemName} Tins: ${qty} (RM ${qty * itemPrice})`, 20, yPos);
      yPos += 10;
    });
    
    doc.setFontSize(16);
    doc.text(`Total Due: RM ${total}`, 20, yPos + 10);
    
    doc.text("Payment Instructions:", 20, yPos + 30);
    doc.setFontSize(12);
    doc.text("1. Transfer to Maybank Singapore: 04071077653 (Trueman Enterprise)", 20, yPos + 40);
    doc.text("2. Put Order ID as Reference", 20, yPos + 50);
    doc.text("3. WhatsApp receipt to +65 9816 4292 (Logan)", 20, yPos + 60);
    
    // Replace slashes with dashes for the filename so it saves safely
    const safeFilename = orderId.replace(/\//g, '-');
    doc.save(`Trueman_Invoice_${safeFilename}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8 text-black">
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h1 className="text-3xl font-black text-orange-600 mb-2">Trueman Enterprise</h1>
        <p className="font-bold text-gray-600 mb-6 bg-orange-100 p-2 rounded text-center">
          Next Delivery: <span className="text-orange-600">{deliveryDate}</span>
        </p>
        
        <div className="space-y-4 mb-8">
          <input type="text" placeholder="Your Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border p-3 rounded-lg" />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border p-3 rounded-lg" />
        </div>
        
        <div className="space-y-4 mb-8">
          {MENU.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border">
              <div>
                <h3 className="font-bold">{item.name}</h3>
                <p className="text-sm text-gray-500">RM{item.price} / tin</p>
              </div>
              <div className="flex gap-4 items-center">
                <button onClick={() => updateCart(item.id, -1)} className="bg-gray-200 w-8 h-8 rounded-full font-bold">-</button>
                <span className="font-bold w-4 text-center">{cart[item.id] || 0}</span>
                <button onClick={() => updateCart(item.id, 1)} className="bg-orange-100 text-orange-600 w-8 h-8 rounded-full font-bold">+</button>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleCheckout} disabled={isOrdering} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-lg shadow-lg">
          {isOrdering ? "Generating Order..." : `Checkout (RM ${totalAmount})`}
        </button>
      </div>
    </div>
  );
}
