const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Starting full database heal: Category & is_known_customer");

  // 1. Fetch all conversations and their customers
  const { data: convs, error: convError } = await supabase
    .from("conversations")
    .select("id, merchant_id, customer_id, category, is_known_customer, customer:customers(name, email)");

  if (convError) {
    console.error("Failed to fetch conversations:", convError);
    return;
  }

  console.log(`Found ${convs.length} conversations to process.`);

  // 2. We need orders to determine is_known_customer, so let's pre-fetch orders per merchant
  const merchantIds = [...new Set(convs.map(c => c.merchant_id))];
  const ordersByMerchant = {};

  for (const mId of merchantIds) {
    const { data: orders } = await supabase.from("orders").select("email").eq("merchant_id", mId);
    ordersByMerchant[mId] = (orders || []).map(o => (o.email || "").toLowerCase());
  }

  const financialKeywords = ["paypal", "google", "shopify", "paddle", "stripe", "mollie"];
  const spamKeywords = ["noreply", "no-reply", "newsletter", "marketing", "promo", "postmaster"];

  let updatedCount = 0;

  for (const c of convs) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const email = (customer?.email || "").toLowerCase();
    
    // Check known customer
    const merchantOrders = ordersByMerchant[c.merchant_id] || [];
    const isKnownCustomer = merchantOrders.includes(email);

    let newCategory = c.category; // Keep existing as fallback or overwrite below?
    // Let's aggressively overwrite to be safe.
    
    const isFinancial = financialKeywords.some(k => email.includes(k));
    const isSpam = spamKeywords.some(k => email.includes(k));

    if (isFinancial) {
      newCategory = "financial";
    } else if (isSpam) {
      newCategory = "spam";
    } else {
      // Fetch latest message
      const { data: messages } = await supabase
        .from("messages")
        .select("metadata")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);
      
      const lastMessage = messages?.[0];
      const intent = lastMessage?.metadata?.intent;
      const requiresHuman = lastMessage?.metadata?.requires_human;
      const negotiationDecision = lastMessage?.metadata?.negotiation_decision;

      // Negotiation overrides
      if (negotiationDecision === "accept" || negotiationDecision === "next_step" || negotiationDecision === "continue") {
        newCategory = "returns";
      } else if (negotiationDecision === "reject") {
        newCategory = "human_required";
      } else {
        if (intent === "wismo" || intent === "resend_confirmation") newCategory = "shipping";
        else if (intent === "return" || intent === "exchange") newCategory = "returns";
        else if (intent === "faq") newCategory = "product";
        else if (intent === "complaint") newCategory = "human_required";
        else if (requiresHuman) newCategory = "human_required";
        else newCategory = "human_required"; // Fallback
      }
    }

    if (c.category !== newCategory || c.is_known_customer !== isKnownCustomer) {
       const { error: updErr } = await supabase
         .from("conversations")
         .update({ category: newCategory, is_known_customer: isKnownCustomer })
         .eq("id", c.id);
         
       if (!updErr) {
         updatedCount++;
       } else {
         console.error("Failed to update", c.id, updErr);
       }
    }
  }

  console.log(`✅ Successfully healed ${updatedCount} conversations! UI tabs should now match.`);
  process.exit(0);
}

run();
