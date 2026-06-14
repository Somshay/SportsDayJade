(function () {
  const config = window.SUPABASE_CONFIG || {};
  const configured =
    /^https:\/\/.+\.supabase\.co$/.test(config.url || "")
    && config.anonKey
    && !config.anonKey.startsWith("YOUR_");

  const client = configured && window.supabase
    ? window.supabase.createClient(config.url, config.anonKey)
    : null;

  function tokenStorageKey(studentKey) {
    return `jade-order-token:${studentKey}`;
  }

  function getEditToken(studentKey, create = false) {
    const storageKey = tokenStorageKey(studentKey);
    let token = localStorage.getItem(storageKey);
    if (!token && create) {
      token = crypto.randomUUID();
      localStorage.setItem(storageKey, token);
    }
    return token;
  }

  function mapOrder(data) {
    if (!data || data.exists === false) return null;
    return {
      exists: true,
      editable: data.editable !== false,
      reference: data.reference || "",
      studentKey: data.student_key || "",
      className: data.class_name || "",
      student: data.student_name || "",
      size: data.shirt_size || "",
      quantity: data.quantity || 1,
      price: data.price || 200,
      payment: data.payment_method || "",
      status: data.status || "",
      hasSlip: Boolean(data.has_slip),
      date: data.cash_date || "",
      time: data.cash_time || "",
      location: data.payment_location || "",
      createdAt: data.created_at || "",
      updatedAt: data.updated_at || ""
    };
  }

  async function findOrder(studentKey) {
    if (!client) throw new Error("SUPABASE_CLIENT_UNAVAILABLE");
    const editToken = getEditToken(studentKey);
    const { data, error } = await client.rpc("get_jade_order", {
      p_student_key: studentKey,
      p_edit_token: editToken
    });
    if (error) throw error;
    return data?.exists ? mapOrder(data) : null;
  }

  async function getRoster() {
    if (!client) throw new Error("SUPABASE_CLIENT_UNAVAILABLE");
    const { data, error } = await client.rpc("get_jade_roster");
    if (error) throw error;
    return (data || []).map((student) => ({
      className: student.class_name,
      name: student.student_name
    }));
  }

  async function verifySlip(file, studentKey) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const body = new FormData();
    body.append("file", file, file.name);
    body.append("studentKey", studentKey);

    const { data, error } = await client.functions.invoke("verify-slip", { body });
    if (error) {
      let detail = null;
      try {
        detail = await error.context?.json();
      } catch {
        detail = null;
      }
      const code = detail?.code || detail?.error;
      if (code === "NOT_FOUND") throw new Error("VERIFY_SLIP_NOT_DEPLOYED");
      const providerDetail = [
        detail?.providerCode,
        detail?.providerMessage || detail?.message
      ]
        .filter(Boolean)
        .join(":");
      throw new Error([code || error.message, providerDetail].filter(Boolean).join("|"));
    }
    if (!data?.verified || !data.verificationToken) {
      throw new Error(data?.error || "SLIP_VERIFICATION_FAILED");
    }
    return data;
  }

  async function saveOrder(order) {
    if (!client) throw new Error("SUPABASE_NOT_CONFIGURED");
    const editToken = getEditToken(order.studentKey, true);

    const { data, error } = await client.rpc("upsert_jade_verified_order", {
      p_student_key: order.studentKey,
      p_class_name: order.className,
      p_student_name: order.student,
      p_shirt_size: order.size,
      p_payment_method: order.payment,
      p_edit_token: editToken,
      p_slip_verification_token: order.slipVerificationToken || null,
      p_cash_date: order.payment === "cash" ? order.date : null,
      p_cash_time: order.payment === "cash" ? order.time : null
    });
    if (error) throw error;
    return mapOrder({ ...data, exists: true, editable: true });
  }

  window.JadeBackend = {
    isConfigured: () => Boolean(configured),
    getRoster,
    findOrder,
    verifySlip,
    saveOrder
  };
})();
