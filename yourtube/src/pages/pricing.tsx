"use client";
import { useState } from "react";
import { Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/lib/AuthContext";
import axiosInstance from "@/lib/axiosinstance";

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    color: "border-gray-300",
    badge: "",
    features: ["1 download/day", "Basic video access", "Comments & likes", "Watch history"],
  },
  {
    id: "bronze",
    name: "Bronze",
    price: 99,
    color: "border-amber-600",
    badge: "bg-amber-600",
    features: ["5 downloads/day", "All Free features", "Ad-free viewing", "Priority support"],
  },
  {
    id: "silver",
    name: "Silver",
    price: 199,
    color: "border-gray-400",
    badge: "bg-gray-400",
    features: ["20 downloads/day", "All Bronze features", "Premium videos", "HD streaming"],
  },
  {
    id: "gold",
    name: "Gold",
    price: 499,
    color: "border-yellow-500",
    badge: "bg-yellow-500",
    features: ["Unlimited downloads", "All Silver features", "Exclusive content", "Early access"],
  },
];

declare global {
  interface Window { Razorpay: any; }
}

export default function PricingPage() {
  const { user, login } = useUser();
  const [loading, setLoading] = useState<string | null>(null);
  const currentPlan = (user as any)?.plan || "free";

  const handleUpgrade = async (planId: string) => {
    if (!user) return alert("Please sign in first.");
    if (planId === "free" || planId === currentPlan) return;
    setLoading(planId);

    try {
      // Create Razorpay order
      const { data } = await axiosInstance.post("/subscription/create-order", { plan: planId });

      // Load Razorpay script
      if (!window.Razorpay) {
        await new Promise<void>((resolve) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.onload = () => resolve();
          document.body.appendChild(s);
        });
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_placeholder",
        amount: data.amount,
        currency: "INR",
        name: "YourTube",
        description: `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await axiosInstance.post("/subscription/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              userId: (user as any)._id,
              plan: planId,
            });
            // Update local user state
            const updatedUser = { ...(user as any), plan: planId };
            login(updatedUser);
            alert(`🎉 Successfully upgraded to ${planId.charAt(0).toUpperCase() + planId.slice(1)} plan!`);
          } catch (err) {
            alert("Payment verified but plan update failed. Contact support.");
          }
        },
        prefill: {
          name: (user as any).name,
          email: (user as any).email,
        },
        theme: { color: "#FF0000" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Payment failed. Try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <Crown className="w-12 h-12 mx-auto text-yellow-500 mb-3" />
        <h1 className="text-3xl font-bold mb-2">Upgrade Your Plan</h1>
        <p className="text-gray-600">Choose the plan that works best for you</p>
        {currentPlan !== "free" && (
          <p className="mt-2 text-green-600 font-medium">
            Current plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`border-2 ${plan.color} rounded-2xl p-6 flex flex-col ${isCurrent ? "ring-2 ring-blue-500" : ""}`}
            >
              {plan.badge && (
                <span className={`${plan.badge} text-white text-xs font-bold px-2 py-1 rounded-full w-fit mb-3`}>
                  {plan.name}
                </span>
              )}
              {!plan.badge && (
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-full w-fit mb-3">
                  Free
                </span>
              )}
              <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
              <p className="text-3xl font-bold mb-4">
                {plan.price === 0 ? "₹0" : `₹${plan.price}`}
                <span className="text-sm font-normal text-gray-500">/month</span>
              </p>
              <ul className="space-y-2 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => handleUpgrade(plan.id)}
                disabled={isCurrent || plan.id === "free" || loading === plan.id}
                className={`w-full ${isCurrent ? "bg-blue-500 text-white" : ""}`}
                variant={isCurrent ? "default" : plan.id === "free" ? "outline" : "default"}
              >
                {isCurrent ? "Current Plan" : plan.id === "free" ? "Free" : loading === plan.id ? "Processing..." : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">
        Payments powered by Razorpay (Test Mode). Use card 4111 1111 1111 1111 for testing.
      </p>
    </div>
  );
}
