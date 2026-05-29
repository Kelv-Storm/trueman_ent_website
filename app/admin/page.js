"use client";
import { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
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

export default function AdminDashboard() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [orders, setOrders] = useState([]);
  const [dateInput, setDateInput] = useState("");
  const [currentDate, setCurrentDate] = useState("Loading...");

  // Check if dad is logged in
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, []);

  // Only load orders if he IS logged in
  useEffect(() => {
    if (!user) return; // Stop if not logged in

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDate = onSnapshot(doc(db, "settings", "storeDetails"), (docSnap) => {
      if (docSnap.exists()) setCurrentDate(docSnap.data().deliveryDate);
    });

    return () => { unsubOrders(); unsubDate(); };
  }, [user]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      alert("Incorrect email or password.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const markAsPaid = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "Paid & Preparing" });
  };

  const saveDeliveryDate = async () => {
    if (!dateInput) return;
    await setDoc(doc(db, "settings", "storeDetails"), { deliveryDate: dateInput }, { merge: true });
    setDateInput("");
    alert("Delivery date updated successfully!");
  };

  const downloadInvoice = (order) => {
    const docPdf = new jsPDF();
    const orderIdToPrint = order.orderId || order.id;

    docPdf.setFontSize(22);
    docPdf.text("Trueman Enterprise - Official Invoice", 20, 20);
    
    docPdf.setFontSize(12);
    docPdf.text(`Order ID: ${orderIdToPrint}`, 20, 40);
    docPdf.text(`Customer: ${order.customer} (${order.phone})`, 20, 50);
    docPdf.text(`Delivery Date: ${currentDate}`, 20, 60);
    
    let yPos = 80;
    if (order.items) {
      Object.entries(order.items).forEach(([itemName, qty]) => {
        const menuObj = MENU.find(m => m.name === itemName);
        const itemPrice = menuObj ? menuObj.price : 0;
        docPdf.text(`${itemName} Tins: ${qty} ($${qty * itemPrice})`, 20, yPos);
        yPos += 10;
      });
    }
    
    docPdf.setFontSize(16);
    docPdf.text(`Total Due: $${order.total}`, 20, yPos + 10);
    
    docPdf.text("Payment Instructions:", 20, yPos + 30);
    docPdf.setFontSize(12);
    docPdf.text("1. Transfer to Maybank Singapore: 04071077653 (Trueman Enterprise)", 20, yPos + 40);
    docPdf.text("2. Put Order ID as Reference", 20, yPos + 50);
    docPdf.text("3. WhatsApp receipt to +65 9816 4292 (Logan)", 20, yPos + 60);
    
    const safeFilename = orderIdToPrint.replace(/\//g, '-');
    docPdf.save(`Trueman_Invoice_${safeFilename}.pdf`);
  };

  // IF NOT LOGGED IN: SHOW LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8 text-white">
        <form onSubmit={handleLogin} className="bg-slate-800 p-8 rounded-xl shadow-xl max-w-sm w-full border border-slate-700">
          <h1 className="text-2xl font-black text-orange-500 mb-6 text-center">Admin Login</h1>
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg mb-4" required />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg mb-6" required />
          <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg">Login</button>
        </form>
      </div>
    );
  }

  // IF LOGGED IN: SHOW DASHBOARD
  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-black text-orange-500">Trueman Admin</h1>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white text-sm underline">Logout</button>
        </div>
        
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl mb-8 flex items-end gap-4">
          <div className="flex-1">
            <p className="text-sm text-slate-400 mb-1">Current Delivery Date Shown to Customers:</p>
            <p className="text-xl font-bold text-emerald-400 mb-4">{currentDate}</p>
            <input 
              type="text" 
              placeholder="e.g., Saturday, 12th November" 
              value={dateInput} 
              onChange={(e) => setDateInput(e.target.value)} 
              className="w-full bg-slate-900 border border-slate-600 p-3 rounded-lg text-white" 
            />
          </div>
          <button onClick={saveDeliveryDate} className="bg-orange-500 hover:bg-orange-400 text-white font-bold px-6 py-3 rounded-lg">
            Update Date
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map(order => {
            const orderDate = order.createdAt?.toDate 
              ? order.createdAt.toDate().toLocaleDateString('en-GB') 
              : "Just now";

            return (
            <div key={order.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{order.customer}</h3>
                    <p className="text-sm text-slate-400">{order.phone} &bull; {orderDate}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${order.status === "Pending Payment" ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                    {order.status}
                  </span>
                </div>
                
                <div className="bg-slate-900/50 p-4 rounded-lg mb-4 text-sm">
                  {order.items && Object.entries(order.items).map(([itemName, qty]) => (
                    <p key={itemName}>{itemName}: <span className="font-bold text-orange-400">{qty} tins</span></p>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between items-center mt-2 border-t border-slate-700 pt-4">
                <p className="font-black text-xl">$ {order.total}</p>
                <div className="flex gap-2">
                  <button onClick={() => downloadInvoice(order)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors">
                    Download PDF 📥
                  </button>
                  {order.status === "Pending Payment" && (
                    <button onClick={() => markAsPaid(order.id)} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-2 rounded-lg text-sm transition-colors">
                      Verify
                    </button>
                  )}
                </div>
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}
