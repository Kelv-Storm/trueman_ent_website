"use client";
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { jsPDF } from "jspdf";

const MENU = [
  { id: 'spicy_dhall', name: 'Spicy Dhall', price: 45, image: '/spicy_dhall.jpg' },
  { id: 'bombay_mixture', name: 'Bombay Spice Mixture', price: 30, image: '/bombay_mixture.jpg' },
  { id: 'kara_bounty', name: 'Kara Bounty', price: 30, image: '/kara_bounty.jpg' },
  { id: 'pagoda', name: 'Pagoda', price: 35, image: '/pagoda.jpg' },
  { id: 'pepper_kara_sev', name: 'Pepper Kara Sev', price: 30, image: '/pepper_kara_sev.jpg' },
  { id: 'spicy_banana_chips', name: 'Spicy Banana Chips', price: 50, image: '/spicy_banana_chips.jpg' },
  { id: 'salted_peanuts', name: 'Salted Peanuts', price: 50, image: '/salted_peanuts.jpg' },
  { id: 'green_beans', name: 'Green Beans', price: 45, image: '/green_beans.jpg' },
  { id: 'spicy_tapioca_chips', name: 'Spicy Tapioca Chips', price: 30, image: '/spicy_tapioca_chips.jpg' }
];

export default function Storefront() {
  const [customerName, setCustomerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  const [cart, setCart] = useState({});
  
  // Custom Items State (Array of 5 slots)
  const [customItems, setCustomItems] = useState([
    { id: 1, name: '', qty: 0 },
    { id: 2, name: '', qty: 0 },
    { id: 3, name: '', qty: 0 },
    { id: 4, name: '', qty: 0 },
    { id: 5, name: '', qty: 0 },
  ]);

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

  const totalCustomQty = customItems.reduce((sum, item) => sum + item.qty, 0);

  const updateCart = (itemId, amount) => {
    setCart(prev => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) + amount)
    }));
  };

  const updateCustomItemName = (id, newName) => {
    setCustomItems(prev => prev.map(item => 
      item.id === id ? { ...item, name: newName } : item
    ));
  };

  const updateCustomItemQty = (id, amount) => {
    setCustomItems(prev => prev.map(item => 
      item.id === id ? { ...item, qty: Math.max(0, item.qty + amount) } : item
    ));
  };

  const handleCheckout = async () => {
    if (!customerName || !storeName || !phone || !address) return alert("Please fill in all your details (Name, Store, Phone, and Address).");
    if (totalAmount === 0 && totalCustomQty === 0) return alert("Please add at least 1 item to your cart.");
    
    setIsOrdering(true);
    
    const orderItems = {};
    
    // Add regular menu items
    MENU.forEach(item => {
      if (cart[item.id] > 0) orderItems[item.name] = cart[item.id];
    });

    // Add custom items
    customItems.forEach(item => {
      if (item.qty > 0) {
        const cName = item.name.trim() || `Custom Request ${item.id}`;
        orderItems[`${cName} (TBD)`] = item.qty;
      }
    });

    const dateObj = new Date();
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const formattedDate = `${yyyy}/${mm}/${dd}`;
    const customOrderId = `${customerName.trim().replace(/\s+/g, '_')}_${formattedDate}`;

    try {
      await addDoc(collection(db, "orders"), {
        orderId: customOrderId,
        customer: customerName,
        storeName: storeName,
        phone: phone,
        address: address,
        items: orderItems,
        total: totalAmount,
        hasCustomItems: totalCustomQty > 0, 
        status: totalCustomQty > 0 ? "Pending Price Review" : "Pending Payment",
        deliveryDate: deliveryDate,
        createdAt: serverTimestamp()
      });

      generateInvoice(customOrderId, totalAmount, orderItems);
      alert("Order placed! Please check the downloaded PDF for payment details.");
      
      // Reset form
      setCart({});
      setCustomItems(customItems.map(item => ({ ...item, name: '', qty: 0 })));
      setCustomerName("");
      setStoreName("");
      setPhone("");
      setAddress("");
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
    doc.text(`Customer: ${customerName}`, 20, 50);
    doc.text(`Store: ${storeName}`, 20, 60);
    doc.text(`Phone: ${phone}`, 20, 70);
    
    const splitAddress = doc.splitTextToSize(`Address: ${address}`, 170);
    doc.text(splitAddress, 20, 80);
    
    let yPos = 80 + (splitAddress.length * 7) + 5;
    doc.text(`Delivery Date: ${deliveryDate}`, 20, yPos);
    
    yPos += 20;
    
    // Print Items
    Object.entries(items).forEach(([itemName, qty]) => {
      if (itemName.includes("(TBD)")) {
        doc.text(`${itemName}: ${qty} (Price: TBD)`, 20, yPos);
      } else {
        const itemPrice = MENU.find(m => m.name === itemName)?.price || 0;
        doc.text(`${itemName} Tins: ${qty} ($${qty * itemPrice})`, 20, yPos);
      }
      yPos += 10;
      
      // Add new page if list gets too long
      if (yPos >= 280) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    doc.setFontSize(16);
    if (totalCustomQty > 0) {
      doc.text(`Estimated Total: $${total} + TBD`, 20, yPos + 10);
    } else {
      doc.text(`Total Due: $${total}`, 20, yPos + 10);
    }
    
    doc.text("Payment Instructions:", 20, yPos + 30);
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Paynow UEN 53330872X Trueman Enterprise", 20, yPos + 40);
    doc.setFont("helvetica", "normal");
    doc.text("2. Put Order ID as Reference", 20, yPos + 50);
    doc.text("3. WhatsApp receipt to +65 9816 4292 (Logan)", 20, yPos + 60);
    
    const safeFilename = orderId.replace(/\//g, '-');
    doc.save(`Trueman_Invoice_${safeFilename}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h1 className="text-3xl font-black text-orange-600 mb-2">Trueman Enterprise</h1>
        <p className="font-bold text-gray-600 mb-6 bg-orange-100 p-2 rounded text-center">
          Next Delivery: <span className="text-orange-600">{deliveryDate}</span>
        </p>
        
        <div className="space-y-4 mb-8">
          <input type="text" placeholder="Your Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <input type="text" placeholder="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <textarea placeholder="Delivery Address" value={address} onChange={(e) => setAddress(e.target.value)} rows="3" className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500 resize-none" />
        </div>
        
        <div className="space-y-4 mb-8">
          {/* Regular Menu Items */}
          {MENU.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border hover:border-orange-200 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 aspect-square shrink-0 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 shadow-sm">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover object-center" />
                </div>
                <div>
                  <h3 className="font-bold leading-tight text-gray-800">{item.name}</h3>
                  <p className="text-sm font-semibold text-orange-600 mt-1">${item.price} / tin</p>
                </div>
              </div>
              <div className="flex gap-3 items-center shrink-0">
                <button onClick={() => updateCart(item.id, -1)} className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors text-gray-700">-</button>
                <span className="font-bold w-5 text-center text-gray-800">{cart[item.id] || 0}</span>
                <button onClick={() => updateCart(item.id, 1)} className="bg-orange-100 hover:bg-orange-200 text-orange-600 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors">+</button>
              </div>
            </div>
          ))}

          {/* Spacer for Custom Items */}
          <div className="pt-4">
            <h3 className="font-bold text-gray-700 mb-2">Special / Custom Orders</h3>
            
            {/* 5 Custom Item Rows */}
            {customItems.map((cItem, index) => (
              <div key={cItem.id} className="flex justify-between items-center bg-orange-50/50 p-3 rounded-lg border border-orange-200 mb-2">
                <div className="flex-1 mr-4">
                  <input
                    type="text"
                    placeholder={`Custom item ${index + 1} (click to type)...`}
                    value={cItem.name}
                    onChange={(e) => updateCustomItemName(cItem.id, e.target.value)}
                    className="w-full text-sm font-medium text-gray-800 border-b border-orange-300 focus:border-orange-500 focus:outline-none bg-transparent py-1 placeholder:text-gray-500"
                  />
                  <p className="text-xs text-orange-600 font-semibold mt-1">Price: TBD (Reviewed by admin)</p>
                </div>
                <div className="flex gap-3 items-center shrink-0">
                  <button onClick={() => updateCustomItemQty(cItem.id, -1)} className="bg-white hover:bg-gray-100 border border-gray-300 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors text-gray-700">-</button>
                  <span className="font-bold w-5 text-center text-gray-800">{cItem.qty}</span>
                  <button onClick={() => updateCustomItemQty(cItem.id, 1)} className="bg-orange-500 hover:bg-orange-600 text-white w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors shadow-sm">+</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Order Summary Note for TBD */}
        {totalCustomQty > 0 && (
          <p className="text-xs text-orange-700 mb-4 bg-orange-100 p-3 rounded-lg text-center font-medium border border-orange-200">
            * Order includes custom item(s). The final total amount will be reviewed and confirmed.
          </p>
        )}

        <button onClick={handleCheckout} disabled={isOrdering} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white font-bold py-4 rounded-xl shadow-lg transition-colors text-lg">
          {isOrdering ? "Generating Order..." : `Checkout ($${totalAmount}${totalCustomQty > 0 ? ' + TBD' : ''})`}
        </button>
      </div>
    </div>
  );
}
