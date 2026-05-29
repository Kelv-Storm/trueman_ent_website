"use client";
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [dateInput, setDateInput] = useState("");
  const [currentDate, setCurrentDate] = useState("Loading...");

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubOrders = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubDate = onSnapshot(doc(db, "settings", "storeDetails"), (docSnap) => {
      if (docSnap.exists()) setCurrentDate(docSnap.data().deliveryDate);
    });

    return () => { unsubOrders(); unsubDate(); };
  }, []);

  const markAsPaid = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "Paid & Preparing" });
  };

  const saveDeliveryDate = async () => {
    if (!dateInput) return;
    await setDoc(doc(db, "settings", "storeDetails"), { deliveryDate: dateInput }, { merge: true });
    setDateInput("");
    alert("Delivery date updated successfully!");
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-orange-500 mb-6">Trueman Admin Dashboard</h1>
        
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
            // Convert Firebase timestamp to a readable Date (DD/MM/YYYY format)
            const orderDate = order.createdAt?.toDate 
              ? order.createdAt.toDate().toLocaleDateString('en-GB') 
              : "Just now";

            return (
            <div key={order.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.customer}</h3>
                  <p className="text-sm text-slate-400">
                    {order.phone} &bull; {orderDate}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${order.status === "Pending Payment" ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {order.status}
                </span>
              </div>
              
              <div className="bg-slate-900/50 p-4 rounded-lg mb-4 text-sm">
                {order.items && Object.entries(order.items).map(([itemName, qty]) => (
                  <p key={itemName}>{itemName}: <span className="font-bold text-orange-400">{qty} tins</span></p>
                ))}
              </div>
              
              <div className="flex justify-between items-center">
                <p className="font-black text-xl">RM {order.total}</p>
                {order.status === "Pending Payment" && (
                  <button onClick={() => markAsPaid(order.id)} className="bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-sm">
                    Verify Payment
                  </button>
                )}
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}
