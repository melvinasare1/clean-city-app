import PaystackPop from "@paystack/inline-js";

// move this to a backend in real usage

export async function initPaystackTransaction(
  email: string,
  amountInCedi: number
) {
  try {
    const response = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount: amountInCedi.toString(), // e.g. 500000 = 5000.00 (in kobo)
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.log("Paystack error response:", data);
      throw new Error(data?.message || "Failed to initialize transaction");
    }

    return data;
  } catch (error) {
    console.error("Error initializing Paystack transaction:", error);
    throw error;
  }
}
