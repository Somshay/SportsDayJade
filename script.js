let classNames = [];
const studentRoster = new Map();
const ORDER_STORAGE_KEY = "jade-shirt-orders-v1";
const backendEnabled = Boolean(window.JadeBackend?.isConfigured());

const sizeData = {
  S: "รอบอก 36 นิ้ว • ยาว 25 นิ้ว",
  M: "รอบอก 38 นิ้ว • ยาว 26 นิ้ว",
  L: "รอบอก 40 นิ้ว • ยาว 27 นิ้ว",
  XL: "รอบอก 42 นิ้ว • ยาว 28 นิ้ว",
  XXL: "รอบอก 44 นิ้ว • ยาว 29 นิ้ว",
  "3XL": "รอบอก 46 นิ้ว • ยาว 30 นิ้ว",
  "4XL": "รอบอก 48 นิ้ว • ยาว 31 นิ้ว",
  "5XL": "รอบอก 50 นิ้ว • ยาว 32 นิ้ว"
};

const state = {
  step: 1,
  className: "",
  student: "",
  size: "",
  team: "JADE",
  payment: "qr",
  slip: null,
  slipVerification: null,
  date: "",
  time: "",
  location: "",
  existingOrder: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const classSelect = $("#classSelect");
const studentSelect = $("#studentSelect");
const shirt = $("#shirtPreview");

function getOrders() {
  try {
    return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function studentOrderKey(className = state.className, student = state.student) {
  return `${className}|${student}`;
}

async function findExistingOrder() {
  const key = studentOrderKey();
  if (backendEnabled) return window.JadeBackend.findOrder(key);
  return getOrders().find((order) => order.studentKey === key) || null;
}

async function saveOrder(order) {
  if (backendEnabled) return window.JadeBackend.saveOrder(order);
  const orders = getOrders();
  const existingIndex = orders.findIndex((item) => item.studentKey === order.studentKey);
  if (existingIndex >= 0) orders[existingIndex] = order;
  else orders.push(order);
  localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  return order;
}

function showExistingOrder(order) {
  const notice = $("#existingOrderNotice");
  const button = $("#toStep2");
  if (!order) {
    notice.classList.add("hidden");
    button.disabled = false;
    button.innerHTML = 'เลือกเสื้อต่อ <span>→</span>';
    return;
  }
  if (order.editable === false) {
    $("#existingOrderDetail").textContent = "นักเรียนคนนี้มีรายการแล้วจากอุปกรณ์อื่น กรุณาติดต่อผู้ดูแลหากต้องการแก้ไข";
    notice.classList.remove("hidden");
    button.disabled = true;
    button.textContent = "มีรายการสั่งซื้อแล้ว";
    return;
  }
  $("#existingOrderDetail").textContent = `ไซซ์ ${order.size} • 1 ตัว • ${order.payment === "qr" ? "ชำระด้วย QR" : "นัดชำระเงินสด"} — ระบบจะแก้ไขรายการเดิม ไม่สร้างรายการซ้ำ`;
  notice.classList.remove("hidden");
  button.disabled = false;
  button.innerHTML = 'แก้ไขรายการเดิม <span>→</span>';
}

function loadExistingOrder(order) {
  if (!order) return;
  state.existingOrder = order;
  state.size = order.size;
  state.payment = order.payment;
  state.date = order.date || "";
  state.time = order.time || "";
  state.location = order.location || "";

  $$("#sizeOptions .choice-button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.size === state.size);
  });
  $("#previewSize").textContent = state.size;
  $("#sizeMeasurement").textContent = sizeData[state.size];

  $$(".payment-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.payment === state.payment));
  $$(".payment-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.paymentPanel === state.payment));
  $("#paymentDate").value = state.date;
  $$("#timeOptions .choice-button").forEach((button) => {
    button.classList.toggle("selected", button.dataset.time === state.time);
  });
  $("#paymentLocation").value = state.location || "กรุณาเลือกวันที่และเวลา";
}

function clearOrderDraft() {
  Object.assign(state, {
    size: "",
    payment: "qr",
    slip: null,
    slipVerification: null,
    date: "",
    time: "",
    location: ""
  });
  $$("#sizeOptions .choice-button, #timeOptions .choice-button").forEach((button) => {
    button.classList.remove("selected");
  });
  $$(".payment-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.payment === "qr"));
  $$(".payment-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.paymentPanel === "qr"));
  $("#slipInput").value = "";
  $("#slipPreview").classList.add("hidden");
  $("#slipVerification").classList.add("hidden");
  $("#paymentDate").value = "";
  $("#paymentLocation").value = "กรุณาเลือกวันที่และเวลา";
  $("#previewSize").textContent = "-";
  $("#sizeMeasurement").textContent = "เลือกไซซ์เพื่อดูขนาด";
}

function studentsForClass(className) {
  return studentRoster.get(className) || [];
}

function populateStaticOptions() {
  Object.keys(sizeData).forEach((size) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = size;
    button.dataset.size = size;
    $("#sizeOptions").append(button);
  });

  const times = [
    { label: "12:20 - 12:40", available: true },
    { label: "16:00 - 16:30", available: true }
  ];
  times.forEach(({ label, available }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice-button";
    button.textContent = available ? label : `${label} เต็ม`;
    button.disabled = !available;
    button.dataset.time = label;
    $("#timeOptions").append(button);
  });
}

async function loadStudentRoster() {
  classSelect.disabled = true;
  classSelect.innerHTML = '<option value="">กำลังโหลดรายชื่อนักเรียน...</option>';

  if (!backendEnabled) {
    classSelect.innerHTML = '<option value="">กรุณาเชื่อมต่อ Supabase</option>';
    showToast("กรุณาตั้งค่า Supabase เพื่อโหลดรายชื่อนักเรียน");
    return;
  }

  try {
    const roster = await window.JadeBackend.getRoster();
    studentRoster.clear();
    roster.forEach(({ className, name }) => {
      if (!studentRoster.has(className)) studentRoster.set(className, []);
      studentRoster.get(className).push(name);
    });
    classNames = [...studentRoster.keys()];
    classSelect.innerHTML = '<option value="">เลือกชั้น / ห้อง</option>';
    classNames.forEach((className) => {
      classSelect.add(new Option(className, className));
    });
    classSelect.disabled = false;

    if (!classNames.length) {
      classSelect.innerHTML = '<option value="">ยังไม่มีรายชื่อนักเรียน</option>';
      classSelect.disabled = true;
      showToast("กรุณานำเข้ารายชื่อนักเรียนใน Supabase");
    }
  } catch (error) {
    console.error(error);
    classSelect.innerHTML = '<option value="">โหลดรายชื่อไม่สำเร็จ</option>';
    showToast("โหลดรายชื่อนักเรียนไม่สำเร็จ");
  }
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function goToStep(step) {
  state.step = step;
  $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.step === String(step)));
  $$(".step").forEach((item, index) => {
    const itemStep = index + 1;
    item.classList.toggle("active", itemStep === step);
    item.classList.toggle("done", typeof step === "number" && itemStep < step);
    item.disabled = typeof step !== "number" || itemStep > step;
  });
  $$(".step-line").forEach((line, index) => line.classList.toggle("done", typeof step === "number" && index + 1 < step));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function animateShirt() {
  shirt.classList.remove("pop");
  requestAnimationFrame(() => shirt.classList.add("pop"));
}

function validateStep1() {
  $("#classError").textContent = state.className ? "" : "กรุณาเลือกชั้น / ห้อง";
  $("#studentError").textContent = state.student ? "" : "กรุณาเลือกชื่อนักเรียน";
  return Boolean(state.className && state.student);
}

function validateStep2() {
  if (!state.size) {
    showToast("กรุณาเลือกขนาดเสื้อ");
    return false;
  }
  return true;
}

function updateOrderSummary() {
  $("#orderSummary").innerHTML = `
    <span><strong>${state.student.replace(/^\d+\.\s/, "")}</strong> • ${state.className}</span>
    <span>JADE • สีเขียวพาสเทล-ขาว • ไซซ์ ${state.size} • <strong>1 ตัว • 200 บาท</strong></span>
  `;
}

function handleSlip(file) {
  if (!file) return;
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    showToast("กรุณาเลือกไฟล์ JPG หรือ PNG เท่านั้น");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("ไฟล์ต้องมีขนาดไม่เกิน 5 MB");
    return;
  }
  state.slip = file;
  state.slipVerification = null;
  $("#slipName").textContent = file.name;
  $("#slipStatus").textContent = "พร้อมส่งตรวจสอบ";
  $("#slipImage").src = URL.createObjectURL(file);
  $("#slipPreview").classList.remove("hidden");
  $("#slipVerification").classList.add("hidden");
  $("#slipVerification").classList.remove("error");
  $(".upload-box small").textContent = "อัปโหลดไฟล์เรียบร้อยแล้ว";
}

function validatePayment() {
  if (state.payment === "qr") {
    if (!state.slip && !state.existingOrder?.hasSlip) {
      showToast("กรุณาอัปโหลดสลิปโอนเงิน");
      return false;
    }
    if (state.slip && !state.slipVerification?.verified) {
      showToast("กรุณารอให้ระบบตรวจสอบสลิป");
      return false;
    }
  }
  if (state.payment === "cash" && (!state.date || !state.time)) {
    showToast("กรุณาเลือกวันที่และช่วงเวลาชำระเงิน");
    return false;
  }
  return true;
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("th-TH", { dateStyle: "long" }).format(new Date(`${dateString}T12:00:00`));
}

function updatePaymentLocation() {
  const locationInput = $("#paymentLocation");
  if (!state.date || !state.time) {
    state.location = "";
    locationInput.value = "กรุณาเลือกวันที่และเวลา";
    return;
  }

  const lunchRooms = {
    1: "ห้อง 1108",
    2: "ห้อง 1203",
    3: "ห้อง 1108",
    4: "ห้อง 1103",
    5: "ห้อง 1102"
  };
  const day = new Date(`${state.date}T12:00:00`).getDay();
  state.location = state.time === "12:20 - 12:40"
    ? (lunchRooms[day] || "ห้อง 1102")
    : "ห้อง 1102";
  locationInput.value = state.location;
}

function openConfirmModal() {
  const paymentDetail = state.payment === "qr"
    ? "QR Code พร้อมแนบสลิป"
    : `เงินสด • ${formatDate(state.date)} • ${state.time} • ${state.location}`;
  $("#modalSummary").innerHTML = `
    <p><span>นักเรียน</span><strong>${state.student.replace(/^\d+\.\s/, "")}</strong></p>
    <p><span>ห้อง</span><strong>${state.className}</strong></p>
    <p><span>เสื้อ</span><strong>JADE สีเขียวพาสเทล-ขาว • ${state.size} • 1 ตัว</strong></p>
    <p><span>ชำระเงิน</span><strong>${paymentDetail}</strong></p>
    <p><span>ยอดรวม</span><strong>200 บาท</strong></p>
  `;
  $("#confirmModal").classList.remove("hidden");
}

function createReceipt(order, isUpdate = false) {
  const now = new Date();
  const reference = order.reference;
  const isQr = state.payment === "qr";
  const isVerified = isQr && order.status === "paid";
  $("#referenceNumber").textContent = reference;
  $("#receiptStatus").textContent = isQr
    ? (isVerified ? "ชำระแล้ว" : "รอตรวจสอบสลิป")
    : "จองคิวแล้ว";
  $("#successTitle").textContent = isUpdate
    ? "แก้ไขรายการเดิมสำเร็จ"
    : (isQr
      ? (isVerified ? "ตรวจสอบการชำระเงินสำเร็จ" : "ส่งสลิปเรียบร้อยแล้ว")
      : "จองคิวชำระเงินสำเร็จ");
  $("#successMessage").textContent = isUpdate
    ? `ระบบอัปเดตรายการเดิมแล้ว โดยยังใช้เลขอ้างอิง ${reference}`
    : (isQr
      ? (isVerified
        ? "Slip2Go ยืนยันสลิป ยอดเงิน 200 บาท และบันทึกการชำระแล้ว"
        : "เจ้าหน้าที่จะตรวจสอบสลิปและอัปเดตสถานะภายหลัง")
      : `กรุณามาชำระเงินตามวันและเวลาที่จองไว้ เลขคิว ${reference}`);

  const details = [
    ["ชื่อผู้สั่ง", state.student.replace(/^\d+\.\s/, "")],
    ["ชั้น / ห้อง", state.className],
    ["ขนาดเสื้อ", state.size],
    ["จำนวน", "1 ตัว"],
    ["ทีม", "JADE • สีเขียวพาสเทล-ขาว"],
    ["วันที่ทำรายการ", new Intl.DateTimeFormat("th-TH", { dateStyle: "long", timeStyle: "short" }).format(now)],
    ["วิธีชำระ", isQr ? "สแกน QR Code" : "ชำระเงินสด"],
    ...(!isQr ? [["วันนัดชำระ", formatDate(state.date)], ["เวลานัด", state.time], ["สถานที่", state.location]] : [])
  ];

  $("#receiptDetails").innerHTML = details.map(([term, value]) => `<div><dt>${term}</dt><dd>${value}</dd></div>`).join("");
  $("#receiptNote").textContent = isQr
    ? (isVerified
      ? "ระบบตรวจสอบสลิปอัตโนมัติแล้ว โปรดเก็บใบเสร็จนี้ไว้เป็นหลักฐาน"
      : "โปรดเก็บหลักฐานนี้ไว้จนกว่าจะได้รับการยืนยันการชำระเงิน")
    : "โปรดแสดงใบนัดนี้แก่เจ้าหน้าที่และมาถึงก่อนเวลานัด 5 นาที";
}

function launchConfetti() {
  const container = $("#confetti");
  const colors = ["#1f6b45", "#51a873", "#82c99a", "#ccebd6", "#e8f7ed"];
  container.innerHTML = "";
  for (let index = 0; index < 28; index += 1) {
    const piece = document.createElement("i");
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.animationDelay = `${Math.random() * 0.45}s`;
    piece.style.setProperty("--drift", `${Math.random() * 100 - 50}px`);
    container.append(piece);
  }
  setTimeout(() => { container.innerHTML = ""; }, 3500);
}

function resetOrder() {
  Object.assign(state, {
    step: 1, className: "", student: "", size: "", team: "JADE",
    payment: "qr", slip: null, slipVerification: null, date: "", time: "",
    location: "", existingOrder: null
  });
  classSelect.value = "";
  studentSelect.innerHTML = '<option value="">กรุณาเลือกชั้นเรียนก่อน</option>';
  studentSelect.disabled = true;
  $("#studentPreview").classList.add("empty");
  $("#studentPreview").innerHTML = '<div class="avatar">?</div><div><small>ข้อมูลผู้สั่งซื้อ</small><strong>ยังไม่ได้เลือกนักเรียน</strong></div>';
  showExistingOrder(null);
  $$(".choice-button").forEach((button) => button.classList.remove("selected"));
  $$(".payment-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.payment === "qr"));
  $$(".payment-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.paymentPanel === "qr"));
  $("#slipInput").value = "";
  $("#slipPreview").classList.add("hidden");
  $("#slipVerification").classList.add("hidden");
  $("#paymentDate").value = "";
  $("#paymentLocation").value = "กรุณาเลือกวันที่และเวลา";
  $("#previewSize").textContent = "-";
  $("#sizeMeasurement").textContent = "เลือกไซซ์เพื่อดูขนาด";
  goToStep(1);
}

populateStaticOptions();
loadStudentRoster();

classSelect.addEventListener("change", () => {
  clearOrderDraft();
  state.className = classSelect.value;
  state.student = "";
  state.existingOrder = null;
  showExistingOrder(null);
  studentSelect.innerHTML = '<option value="">เลือกชื่อนักเรียน</option>';
  if (state.className) {
    studentsForClass(state.className).forEach((name) => studentSelect.add(new Option(name, name)));
    studentSelect.disabled = false;
  } else {
    studentSelect.innerHTML = '<option value="">กรุณาเลือกชั้นเรียนก่อน</option>';
    studentSelect.disabled = true;
  }
  validateStep1();
});

studentSelect.addEventListener("change", async () => {
  clearOrderDraft();
  state.student = studentSelect.value;
  const preview = $("#studentPreview");
  if (state.student) {
    const cleanName = state.student.replace(/^\d+\.\s/, "");
    preview.classList.remove("empty");
    preview.innerHTML = `<div class="avatar">${cleanName.charAt(0)}</div><div><small>ข้อมูลผู้สั่งซื้อ</small><strong>${cleanName} • ${state.className}</strong></div>`;
    const selectedStudent = state.student;
    const button = $("#toStep2");
    button.disabled = true;
    button.textContent = backendEnabled ? "กำลังตรวจสอบรายการ..." : "กำลังตรวจสอบ...";
    try {
      const order = await findExistingOrder();
      if (state.student !== selectedStudent) return;
      state.existingOrder = order;
      showExistingOrder(order);
    } catch (error) {
      console.error(error);
      if (state.student !== selectedStudent) return;
      state.existingOrder = null;
      $("#existingOrderNotice").classList.add("hidden");
      button.disabled = true;
      button.textContent = "เชื่อมต่อฐานข้อมูลไม่สำเร็จ";
      showToast("เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  } else {
    preview.classList.add("empty");
    state.existingOrder = null;
    showExistingOrder(null);
  }
  validateStep1();
});

$("#toStep2").addEventListener("click", () => {
  if (validateStep1()) {
    loadExistingOrder(state.existingOrder);
    goToStep(2);
  }
});

$("#sizeOptions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  state.size = button.dataset.size;
  $$("#sizeOptions .choice-button").forEach((item) => item.classList.toggle("selected", item === button));
  $("#previewSize").textContent = state.size;
  $("#sizeMeasurement").textContent = sizeData[state.size];
  animateShirt();
});

$("#sizeGuideButton").addEventListener("click", () => {
  $("#infoTitle").textContent = "ตารางขนาดเสื้อ";
  $("#infoContent").innerHTML = Object.entries(sizeData).map(([size, detail]) => `<p><strong>${size}</strong> — ${detail}</p>`).join("");
  $("#infoModal").classList.remove("hidden");
});

$("#toStep3").addEventListener("click", () => {
  if (validateStep2()) {
    updateOrderSummary();
    goToStep(3);
  }
});

$$(".back-button").forEach((button) => button.addEventListener("click", () => goToStep(state.step - 1)));
$$(".step").forEach((button) => button.addEventListener("click", () => {
  const target = Number(button.dataset.stepTarget);
  if (target < state.step) goToStep(target);
}));

$$(".payment-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.payment = tab.dataset.payment;
  $$(".payment-tab").forEach((item) => item.classList.toggle("active", item === tab));
  $$(".payment-panel").forEach((panel) => panel.classList.toggle("active", panel.dataset.paymentPanel === state.payment));
}));

$("#slipInput").addEventListener("change", (event) => handleSlip(event.target.files[0]));
const uploadBox = $("#uploadBox");
["dragenter", "dragover"].forEach((type) => uploadBox.addEventListener(type, (event) => {
  event.preventDefault();
  uploadBox.classList.add("dragging");
}));
["dragleave", "drop"].forEach((type) => uploadBox.addEventListener(type, (event) => {
  event.preventDefault();
  uploadBox.classList.remove("dragging");
}));
uploadBox.addEventListener("drop", (event) => handleSlip(event.dataTransfer.files[0]));

$("#removeSlip").addEventListener("click", () => {
  state.slip = null;
  state.slipVerification = null;
  $("#slipInput").value = "";
  $("#slipPreview").classList.add("hidden");
  $("#slipVerification").classList.add("hidden");
  $("#slipVerification").classList.remove("error");
  $(".upload-box small").textContent = "ยังไม่ได้เลือกไฟล์";
});

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

$("#paymentDate").min = localDateValue();
$("#paymentDate").addEventListener("change", (event) => {
  const selectedDate = event.target.value;
  const day = selectedDate ? new Date(`${selectedDate}T12:00:00`).getDay() : null;
  if (day === 0 || day === 6) {
    event.target.value = "";
    state.date = "";
    updatePaymentLocation();
    showToast("กรุณาเลือกวันจันทร์ถึงวันศุกร์");
    return;
  }
  state.date = selectedDate;
  updatePaymentLocation();
});
$("#timeOptions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-time]");
  if (!button || button.disabled) return;
  state.time = button.dataset.time;
  $$("#timeOptions .choice-button").forEach((item) => item.classList.toggle("selected", item === button));
  updatePaymentLocation();
});

$("#confirmOrder").addEventListener("click", async () => {
  const button = $("#confirmOrder");

  if (
    state.payment === "qr"
    && state.slip
    && !state.slipVerification?.verified
  ) {
    if (!backendEnabled) {
      showToast("กรุณาเชื่อมต่อ Supabase ก่อนตรวจสอบสลิป");
      return;
    }

    button.classList.add("loading");
    button.disabled = true;
    button.textContent = "กำลังตรวจสอบสลิป...";
    $("#slipStatus").textContent = "กำลังตรวจสอบกับ Slip2Go...";

    try {
      const result = await window.JadeBackend.verifySlip(
        state.slip,
        studentOrderKey()
      );
      state.slipVerification = result;
      $("#slipStatus").textContent = "ตรวจสอบผ่านแล้ว";
      const verification = $("#slipVerification");
      verification.textContent = `✓ สลิปถูกต้อง ยอด ${Number(result.amount).toFixed(2)} บาท`;
      verification.classList.remove("hidden", "error");
      showToast("ตรวจสอบสลิปสำเร็จ");
    } catch (error) {
      console.error(error);
      state.slipVerification = null;
      $("#slipStatus").textContent = "ตรวจสอบไม่ผ่าน";
      const verification = $("#slipVerification");
      const message = error?.message || "";
      if (message.includes("VERIFY_SLIP_NOT_DEPLOYED")) {
        verification.textContent = "ยังไม่ได้ Deploy ฟังก์ชัน verify-slip ใน Supabase";
      } else if (message.includes("SERVER_NOT_CONFIGURED")) {
        verification.textContent = "Edge Function ยังตั้งค่า Slip2Go Secrets ไม่ครบ";
      } else if (
        message.includes("SLIP_ALREADY_USED")
        || message.includes("200501")
        || message.toLowerCase().includes("duplicated")
      ) {
        verification.textContent = "สลิปนี้ถูกใช้ตรวจสอบไปแล้ว กรุณาใช้สลิปใหม่";
      } else if (
        message.includes("SLIP_FLAGGED_AS_FRAUD")
        || message.includes("200500")
        || message.toLowerCase().includes("slip is fraud")
      ) {
        verification.textContent = "Slip2Go ไม่รองรับรูปแบบสลิป Bangkok Bank นี้ กรุณาใช้ไฟล์สลิปต้นฉบับจากแอป หรือติดต่อผู้ดูแลเพื่อตรวจสอบด้วยตนเอง";
      } else if (message.includes("receiver") || message.includes("ผู้รับ")) {
        verification.textContent = "บัญชีผู้รับในสลิปไม่ตรงกับบัญชีที่ตั้งไว้ กรุณาตรวจสอบการตั้งค่า K Plus Wallet";
      } else if (message.includes("amount") || message.includes("ยอดเงิน")) {
        verification.textContent = "ยอดเงินในสลิปต้องเท่ากับ 200.00 บาท";
      } else if (message.includes("token") || message.includes("credit")) {
        verification.textContent = "Slip2Go Token หรือเครดิตไม่เพียงพอ กรุณาตรวจสอบบัญชี Slip2Go";
      } else {
        verification.textContent = "ตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบรูป ยอดเงิน และบัญชีผู้รับ";
      }
      verification.classList.remove("hidden");
      verification.classList.add("error");
      showToast(verification.textContent);
      return;
    } finally {
      button.classList.remove("loading");
      button.disabled = false;
      button.textContent = "ยืนยันรายการ";
    }
  }

  if (validatePayment()) openConfirmModal();
});

function closeConfirmModal() { $("#confirmModal").classList.add("hidden"); }
$("#closeModal").addEventListener("click", closeConfirmModal);
$("#cancelConfirm").addEventListener("click", closeConfirmModal);

$("#finalConfirm").addEventListener("click", async () => {
  const button = $("#finalConfirm");
  button.classList.add("loading");
  button.disabled = true;
  button.textContent = "กำลังบันทึก...";
  try {
    const now = new Date();
    const isUpdate = Boolean(state.existingOrder);
    const prefix = state.payment === "qr" ? "PAY" : "CASH";
    const reference = state.existingOrder?.reference
      || `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
    const order = {
      reference,
      studentKey: studentOrderKey(),
      className: state.className,
      student: state.student,
      size: state.size,
      quantity: 1,
      price: 200,
      payment: state.payment,
      date: state.payment === "cash" ? state.date : "",
      time: state.payment === "cash" ? state.time : "",
      location: state.payment === "cash" ? state.location : "",
      status: state.payment === "qr" ? "pending_verification" : "cash_booked",
      hasSlip: state.payment === "qr",
      slipVerificationToken: state.payment === "qr"
        ? state.slipVerification?.verificationToken || null
        : null,
      createdAt: state.existingOrder?.createdAt || now.toISOString(),
      updatedAt: now.toISOString()
    };
    const savedOrder = await saveOrder(order);
    state.location = savedOrder.location || state.location;
    state.existingOrder = savedOrder;
    closeConfirmModal();
    createReceipt(savedOrder, isUpdate);
    goToStep("success");
    launchConfetti();
  } catch (error) {
    console.error(error);
    const message = error?.message || "";
    if (message.includes("ORDER_ALREADY_EXISTS")) {
      showToast("นักเรียนคนนี้มีรายการแล้ว กรุณาติดต่อผู้ดูแลเพื่อแก้ไข");
    } else if (message.includes("PAST_CASH_DATE_NOT_ALLOWED")) {
      showToast("ไม่สามารถจองวันที่ผ่านมาแล้วได้");
    } else if (message.includes("WEEKENDS_NOT_ALLOWED")) {
      showToast("กรุณาเลือกวันจันทร์ถึงวันศุกร์");
    } else if (message.includes("42702") || message.includes("token_hash")) {
      showToast("ฐานข้อมูลยังไม่ได้ติดตั้ง SQL แก้ไขล่าสุด");
    } else if (message.includes("SLIP_VERIFICATION_NOT_FOUND")) {
      showToast("ไม่พบข้อมูลยืนยันสลิป กรุณาอัปโหลดและตรวจสอบสลิปใหม่");
    } else if (message.includes("SLIP_VERIFICATION_ALREADY_USED")) {
      showToast("สลิปนี้ถูกใช้บันทึกรายการแล้ว");
    } else if (message.includes("SLIP_VERIFICATION_EXPIRED")) {
      showToast("การยืนยันสลิปหมดอายุ กรุณาอัปโหลดสลิปใหม่");
    } else if (message.includes("Could not find the function")) {
      showToast("ยังไม่ได้ติดตั้งฟังก์ชันบันทึกรายการใน Supabase");
    } else {
      showToast("บันทึกรายการไม่สำเร็จ กรุณาลองอีกครั้ง");
    }
  } finally {
    button.classList.remove("loading");
    button.disabled = false;
    button.textContent = "ยืนยันและส่งข้อมูล";
  }
});

$("#printReceipt").addEventListener("click", async () => {
  const button = $("#printReceipt");
  const receipt = $("#receipt");
  const originalText = button.textContent;

  button.classList.add("loading");
  button.disabled = true;
  button.textContent = "กำลังบันทึก...";

  try {
    if (typeof window.html2canvas !== "function") {
      window.print();
      return;
    }

    const canvas = await window.html2canvas(receipt, {
      backgroundColor: "#ffffff",
      scale: Math.min(window.devicePixelRatio || 2, 2),
      useCORS: true
    });
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("RECEIPT_IMAGE_FAILED");

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `JADE-${$("#referenceNumber").textContent || "receipt"}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showToast("บันทึกหลักฐานเรียบร้อยแล้ว");
  } catch (error) {
    console.error(error);
    showToast("บันทึกรูปภาพไม่สำเร็จ กำลังเปิดหน้าพิมพ์แทน");
    window.print();
  } finally {
    button.classList.remove("loading");
    button.disabled = false;
    button.textContent = originalText;
  }
});
$("#newOrder").addEventListener("click", resetOrder);
$("#helpButton").addEventListener("click", () => {
  $("#infoTitle").textContent = "วิธีสั่งซื้อ";
  $("#infoContent").innerHTML = "<p>1. เลือกชั้น ห้อง และชื่อของนักเรียน</p><p>2. เลือกขนาดเสื้อและสีประจำทีม</p><p>3. สแกน QR พร้อมแนบสลิป หรือจองคิวชำระเงินสด</p>";
  $("#infoModal").classList.remove("hidden");
});
$$(".close-info").forEach((button) => button.addEventListener("click", () => $("#infoModal").classList.add("hidden")));
$$(".modal-backdrop").forEach((backdrop) => backdrop.addEventListener("click", (event) => {
  if (event.target === backdrop) backdrop.classList.add("hidden");
}));
