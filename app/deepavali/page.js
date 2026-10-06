"use client";
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase'; 
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { jsPDF } from "jspdf";
import { DEEPAVALI_MENU } from './menu'; 

const FIREBASE_COLLECTION = "orders"; 

export default function DeepavaliStorefront() {
  const [customerName, setCustomerName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  
  const [cart, setCart] = useState({});
  
  const [customItems, setCustomItems] = useState([
    { id: 1, name: '', qty: 0 },
    { id: 2, name: '', qty: 0 },
    { id: 3, name: '', qty: 0 },
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

  const totalAmount = DEEPAVALI_MENU.reduce((sum, item) => {
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
    if (!customerName || !storeName || !phone || !address) return alert("Please fill in all your details.");
    if (totalAmount === 0 && totalCustomQty === 0) return alert("Please add at least 1 item to your cart.");
    
    setIsOrdering(true);
    
    const orderItems = {};
    DEEPAVALI_MENU.forEach(item => {
      if (cart[item.id] > 0) orderItems[item.name] = cart[item.id];
    });

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
    const customOrderId = `${customerName.trim().replace(/\s+/g, '_')}_${yyyy}${mm}${dd}`;

    try {
      await addDoc(collection(db, FIREBASE_COLLECTION), {
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
      alert("Deepavali Order placed! Please check the downloaded PDF.");
      
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
    doc.text("Trueman Enterprise - Deepavali Order", 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Order ID: ${orderId}`, 20, 40);
    doc.text(`Customer: ${customerName}`, 20, 50);
    doc.text(`Store: ${storeName}`, 20, 60);
    doc.text(`Phone: ${phone}`, 20, 70);
    
    const splitAddress = doc.splitTextToSize(`Address: ${address}`, 170);
    doc.text(splitAddress, 20, 80);
    
    let yPos = 80 + (splitAddress.length * 7) + 5;
    doc.text(`Delivery Date: ${deliveryDate}`, 20, yPos);
    
    yPos += 15;
    
    Object.entries(items).forEach(([itemName, qty]) => {
      if (itemName.includes("(TBD)")) {
        doc.text(`${itemName}: ${qty} (Price: TBD)`, 20, yPos);
      } else {
        const itemPrice = DEEPAVALI_MENU.find(m => m.name === itemName)?.price || 0;
        doc.text(`${itemName} Tins: ${qty} ($ ${qty * itemPrice})`, 20, yPos);
      }
      yPos += 8;
      
      if (yPos >= 280) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    doc.setFontSize(16);
    if (totalCustomQty > 0) {
      doc.text(`Estimated Total: $ ${total} + TBD`, 20, yPos + 10);
    } else {
      doc.text(`Total Due: $ ${total}`, 20, yPos + 10);
    }
    
    doc.text("Payment Instructions:", 20, yPos + 30);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("1. Paynow UEN 53330872X Trueman Enterprise", 20, yPos + 40);
    doc.setFont("helvetica", "normal");
    doc.text("2. Put Order ID as Reference", 20, yPos + 50);
    doc.text("3. WhatsApp receipt to +65 9816 4292 (Logan)", 20, yPos + 60);
    
    doc.save(`Trueman_Deepavali_${orderId}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 text-black">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h1 className="text-3xl font-black text-orange-600 mb-2">Trueman Enterprise</h1>
        <h2 className="text-xl font-bold text-gray-800 mb-4">✨ Deepavali Special Menu ✨</h2>
        
        <p className="font-bold text-gray-600 mb-6 bg-orange-100 p-2 rounded text-center">
          Next Delivery: <span className="text-orange-600">{deliveryDate}</span>
        </p>
        
        <div className="space-y-4 mb-8">
          <input type="text" placeholder="Your Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <input type="text" placeholder="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500" />
          <textarea placeholder="Delivery Address" value={address} onChange={(e) => setAddress(e.target.value)} rows="3" className="w-full border p-3 rounded-lg focus:outline-orange-500 focus:ring-1 focus:ring-orange-500 resize-none" />
        </div>
        
        <div className="space-y-3 mb-8">
          <h3 className="font-bold text-lg text-gray-800 border-b pb-2">Deepavali Catalog ({DEEPAVALI_MENU.length} Items)</h3>
          
          {DEEPAVALI_MENU.map((item) => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border hover:border-orange-200 transition-colors">
              <div className="flex items-center gap-4">
                
                {/* Hides the image box entirely until you upload the actual image to the public folder */}
                {item.image && (
                  <div className="w-16 h-16 aspect-square shrink-0 bg-gray-200 rounded-lg overflow-hidden border border-gray-300 hidden md:block">
                    {/* The alt attribute prevents a broken image icon if the file doesn't exist yet */}
                    <img src={item.image} alt={item.name} onError={(e) => e.target.style.display='none'} className="w-full h-full object-cover object-center" />
                  </div>
                )}
                
                <div>
                  <h3 className="font-bold leading-tight text-gray-800">{item.name}</h3>
                  <p className="text-sm font-semibold text-orange-600 mt-1">$ {item.price}</p>
                </div>
              </div>
              <div className="flex gap-3 items-center shrink-0">
                <button onClick={() => updateCart(item.id, -1)} className="bg-gray-200 hover:bg-gray-300 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors text-gray-700">-</button>
                <span className="font-bold w-5 text-center text-gray-800">{cart[item.id] || 0}</span>
                <button onClick={() => updateCart(item.id, 1)} className="bg-orange-100 hover:bg-orange-200 text-orange-600 w-8 h-8 rounded-full font-bold flex items-center justify-center transition-colors">+</button>
              </div>
            </div>
          ))}

          <div className="pt-4 mt-6 border-t">
            <h3 className="font-bold text-gray-700 mb-2">Special / Custom Orders</h3>
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

        <button onClick={handleCheckout} disabled={isOrdering} className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-70 text-white font-bold py-4 rounded-xl shadow-lg transition-colors text-lg sticky bottom-4">
          {isOrdering ? "Processing..." : `Checkout ($ ${totalAmount}${totalCustomQty > 0 ? ' + TBD' : ''})`}
        </button>
      </div>
    </div>
  );
}