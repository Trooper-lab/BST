import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

/**
 * Example Backend Function: Contact Form Handler
 * This function triggers on an HTTP request (POST) and could save data to Firestore
 * or send an email via a service like SendGrid.
 */
export const contactFormHandler = functions.https.onRequest(async (req, res) => {
  // Security check: Only allow POST
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { name, email, message } = req.body;

    // Validate inputs
    if (!name || !email || !message) {
      res.status(400).send("Missing required fields");
      return;
    }

    // Example logic: Save to Firestore
    await admin.firestore().collection("contact_submissions").add({
      name,
      email,
      message,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({ success: true, message: "Message sent successfully!" });
  } catch (error) {
    console.error("Error handling contact form:", error);
    res.status(500).send("Internal Server Error");
  }
});
