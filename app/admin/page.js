"use client";
import { useEffect, useState } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { jsPDF } from "jspdf";

const MENU = [
  { id: 'spicy_dhall', name: 'Spicy Dhall', price: 45 },
  { id: 'bombay_mixture', name: 'Bombay Spice Mixture', price: 30 },
  { id: 'kara_bounty', name: 'Kara Bounty', price: 30 },
  { id: 'pagoda', name: 'Pagoda', price: 35 },
  { id: 'pepper_kara_sev', name: 'Pepper Kara Sev', price: 30 },
  { id: 'spicy_banana_chips', name: 'Spicy Banana Chips', price: 45 },
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

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
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

  const deleteOrder = async (orderId) => {
    const isConfirmed = window.confirm("Are you sure you want to delete this order? This cannot be undone.");
    if (isConfirmed) {
      await deleteDoc(doc(db, "orders", orderId));
    }
  };

  const saveDeliveryDate = async () => {
    if (!dateInput) return;
    await setDoc(doc(db, "settings", "storeDetails"), { deliveryDate: dateInput }, { merge: true });
    setDateInput("");
    alert("Delivery date updated successfully!");
  };

  // Individual Order PDF
  const downloadInvoice = (order) => {
    const docPdf = new jsPDF();
    const orderIdToPrint = order.orderId || order.id;

    docPdf.setFontSize(22);
    docPdf.text("Trueman Enterprise - Official Invoice", 20, 20);
    
    docPdf.setFontSize(12);
    docPdf.text(`Order ID: ${orderIdToPrint}`, 20, 40);
    docPdf.text(`Customer: ${order.customer}`, 20, 50);
    docPdf.text(`Store: ${order.storeName || "N/A"}`, 20, 60);
    docPdf.text(`Phone: ${order.phone}`, 20, 70);
    
    const splitAddress = docPdf.splitTextToSize(`Address: ${order.address || "N/A"}`, 170);
    docPdf.text(splitAddress, 20, 80);
    
    let yPos = 80 + (splitAddress.length * 7) + 5;
    docPdf.text(`Delivery Date: ${order.deliveryDate || currentDate}`, 20, yPos);
    
    yPos += 20;
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
    docPdf.setFont("helvetica", "bold");
    docPdf.text("1. Paynow UEN 53330872X Trueman Enterprise", 20, yPos + 40);
    docPdf.setFont("helvetica", "normal");
    docPdf.text("2. Put Order ID as Reference", 20, yPos + 50);
    docPdf.text("3. WhatsApp receipt to +65 9816 4292 (Logan)", 20, yPos + 60);
    
    const safeFilename = orderIdToPrint.replace(/\//g, '-');
    docPdf.save(`Trueman_Invoice_${safeFilename}.pdf`);
  };

  const groupedOrders = orders.reduce((groups, order) => {
    const fallbackDate = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString('en-GB') : "Unknown Date"; 
    const groupDate = order.deliveryDate || fallbackDate; 
    
    if (!groups[groupDate]) {
      groups[groupDate] = [];
    }
    groups[groupDate].push(order);
    return groups;
  }, {});

  // PDF 1: KITCHEN SUMMARY (No prices, no customer info)
  const generateKitchenSummaryPDF = (dateGroup, groupOrders) => {
    const docPdf = new jsPDF();
    let yPos = 20;

    const checkPageBreak = (neededHeight) => {
      if (yPos + neededHeight > 280) {
        docPdf.addPage();
        yPos = 20;
      }
    };

    docPdf.setFontSize(22);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(`Kitchen Production Summary`, 20, yPos);
    yPos += 10;
    
    docPdf.setFontSize(14);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Delivery Date: ${dateGroup}`, 20, yPos);
    yPos += 15;

    const summaryData = {};
    groupOrders.forEach(order => {
      if (order.items) {
        Object.entries(order.items).forEach(([itemName, qty]) => {
          summaryData[itemName] = (summaryData[itemName] || 0) + qty;
        });
      }
    });

    docPdf.setFontSize(14);
    if (Object.keys(summaryData).length === 0) {
      docPdf.text("No items ordered for this date.", 20, yPos);
    } else {
      Object.entries(summaryData).sort().forEach(([itemName, totalQty]) => {
        checkPageBreak(15);
        docPdf.text(`${itemName}:`, 20, yPos);
        docPdf.setFont("helvetica", "bold");
        docPdf.text(`${totalQty} tins`, 100, yPos);
        docPdf.setFont("helvetica", "normal");
        yPos += 10;
      });
    }

    const safeDateName = dateGroup.replace(/[\/\s,]+/g, '_');
    docPdf.save(`Kitchen_Summary_${safeDateName}.pdf`);
  };

  // PDF 2: CUSTOMER BREAKDOWN (For Dad's records)
  const generateCustomerBreakdownPDF = (dateGroup, groupOrders) => {
    const docPdf = new jsPDF();
    let yPos = 20;

    const checkPageBreak = (neededHeight) => {
      if (yPos + neededHeight > 280) {
        docPdf.addPage();
        yPos = 20;
      }
    };

    docPdf.setFontSize(22);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(`Customer Breakdown & Revenue`, 20, yPos);
    yPos += 10;
    
    docPdf.setFontSize(14);
    docPdf.setFont("helvetica", "normal");
    docPdf.text(`Delivery Date: ${dateGroup}`, 20, yPos);
    yPos += 15;

    let grandTotal = 0;

    groupOrders.forEach(order => {
      grandTotal += (order.total || 0);
      checkPageBreak(25);
      
      docPdf.setFontSize(12);
      docPdf.setFont("helvetica", "bold");
      const storeLabel = order.storeName ? `(${order.storeName})` : "";
      docPdf.text(`${order.customer} ${storeLabel}`, 20, yPos);
      
      docPdf.text(`$${order.total}`, 170, yPos);
      yPos += 6;
      
      let itemString = Object.entries(order.items || {}).map(([k, v]) => `${v}x ${k}`).join(', ');
      docPdf.setFontSize(10);
      docPdf.setFont("helvetica", "normal");
      docPdf.setTextColor(100); 
      
      const splitItems = docPdf.splitTextToSize(itemString, 170);
      docPdf.text(splitItems, 20, yPos);
      yPos += (splitItems.length * 5) + 6;
      docPdf.setTextColor(0); 
    });

    yPos += 10;
    checkPageBreak(20);
    docPdf.setFontSize(18);
    docPdf.setFont("helvetica", "bold");
    docPdf.text(`Grand Total Revenue: $${grandTotal}`, 20, yPos);

    const safeDateName = dateGroup.replace(/[\/\s,]+/g, '_');
    docPdf.save(`Customer_Breakdown_${safeDateName}.pdf`);
  };

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
        
        {Object.entries(groupedOrders).map(([dateGroup, groupOrders]) => (
          <div key={dateGroup} className="mb-12">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-700 pb-4 gap-4">
              <h2 className="text-2xl font-bold text-orange-400">{dateGroup}</h2>
              <div className="flex gap-2 flex-wrap">
                <button 
                  onClick={() => generateKitchenSummaryPDF(dateGroup, groupOrders)} 
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  Kitchen Summary 👨‍🍳
                </button>
                <button 
                  onClick={() => generateCustomerBreakdownPDF(dateGroup, groupOrders)} 
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  Customer Breakdown 🧾
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupOrders.map(order => {
                const orderDate = order.createdAt?.toDate 
                  ? order.createdAt.toDate().toLocaleDateString('en-GB') 
                  : "Just now";

                return (
                <div key={order.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg leading-tight">
                          {order.customer} 
                          <span className="block text-sm font-normal text-emerald-400 mt-1">{order.storeName || "No Store Name"}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-2">{order.phone}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{order.address || "No Address"}</p>
                        <p className="text-xs text-slate-500 mt-2">&bull; {orderDate}</p>
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
                      <button onClick={() => deleteOrder(order.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold px-3 py-2 rounded-lg text-sm transition-colors border border-red-500/30">
                        Delete
                      </button>
                      <button onClick={() => downloadInvoice(order)} className="bg-slate-700 hover:bg-slate-600 text-white font-bold px-3 py-2 rounded-lg text-sm transition-colors">
                        Get PDF
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
        ))}

      </div>
    </div>
  );
}
