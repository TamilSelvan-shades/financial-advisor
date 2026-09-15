'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ProUpgradeButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first');
        return;
      }

      // 1. Create or fetch Razorpay Customer
      const custRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/customer`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!custRes.ok) {
        const custData = await custRes.json().catch(() => ({}));
        throw new Error(custData.detail || 'Failed to set up customer account with Razorpay');
      }

      // 2. Create Subscription
      const subRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/v1/billing/subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const subData = await subRes.json();

      if (!subRes.ok) {
        throw new Error(subData.detail || 'Failed to create subscription');
      }

      // 3. Load Razorpay script dynamically
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load. Are you online?');
      }

      // 4. Initialize Razorpay Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, 
        subscription_id: subData.razorpay_subscription_id,
        name: 'Enterprise Financial AI',
        description: 'Pro Subscription Upgrade',
        handler: function (response: any) {
          // Success callback
          alert(`Success! Payment ID: ${response.razorpay_payment_id}. Subscription is active.`);
          
          // Force a dashboard refresh to pick up new status
          router.refresh();
        },
        theme: {
          color: '#3399cc',
        },
      };

      // @ts-ignore
      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        alert(`Payment failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleUpgrade}
      disabled={loading}
      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
    >
      {loading ? 'Processing...' : 'Upgrade to Pro'}
    </button>
  );
}
