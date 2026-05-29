"use client";
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const markAsPaid = async (orderId) => {
    await updateDoc(doc(db, "orders", orderId), { status: "Paid & Preparing" });
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-black text-orange-500 mb-8">Seller Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map(order => (
            <div key={order.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-lg">{order.customer}</h3>
                  <p className="text-sm text-slate-400">{order.phone}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${order.status === "Pending Payment" ? "bg-yellow-500/20 text-yellow-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                  {order.status}
                </span>
              </div>
              
              <div className="bg-slate-900/50 p-4 rounded-lg mb-4 text-sm">
                <p>Mixture: <span className="font-bold text-orange-400">{order.items?.mixture || 0} tins</span></p>
                <p>Omapodi: <span className="font-bold text-orange-400">{order.items?.omapodi || 0} tins</span></p>
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
          ))}
        </div>
      </div>
    </div>
  );
}