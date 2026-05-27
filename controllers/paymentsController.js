const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { Order, Payment } = require('../models/index');

// ✅ CRÉER UNE INTENTION DE PAIEMENT
exports.createPaymentIntent = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findOne({
      where: { id: orderId, userId: req.user.id }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande introuvable'
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Cette commande est déjà payée'
      });
    }

    // Créer le PaymentIntent Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(order.totalAmount * 100), // en centimes
      currency: 'eur',
      metadata: {
        orderId: order.id.toString(),
        orderNumber: order.orderNumber,
        userId: req.user.id.toString()
      }
    });

    // Sauvegarder dans la base de données
    await Payment.create({
      orderId: order.id,
      userId: req.user.id,
      stripePaymentId: paymentIntent.id,
      stripeClientSecret: paymentIntent.client_secret,
      amount: order.totalAmount,
      currency: 'eur',
      status: 'pending'
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: order.totalAmount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ CONFIRMER LE PAIEMENT
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentIntentId, orderId } = req.body;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Mettre à jour le paiement
      await Payment.update(
        { status: 'succeeded' },
        { where: { stripePaymentId: paymentIntentId } }
      );

      // Mettre à jour la commande
      await Order.update(
        { paymentStatus: 'paid', status: 'confirmed' },
        { where: { id: orderId } }
      );

      res.status(200).json({
        success: true,
        message: 'Paiement confirmé !'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Paiement non confirmé'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ✅ WEBHOOK STRIPE
exports.stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ message: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await Payment.update(
        { status: 'succeeded' },
        { where: { stripePaymentId: paymentIntent.id } }
      );
      await Order.update(
        { paymentStatus: 'paid', status: 'confirmed' },
        { where: { id: paymentIntent.metadata.orderId } }
      );
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      await Payment.update(
        { status: 'failed' },
        { where: { stripePaymentId: failedPayment.id } }
      );
      break;
  }

  res.json({ received: true });
};

// ✅ REMBOURSEMENT
exports.refundPayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const payment = await Payment.findOne({ where: { orderId } });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Paiement introuvable'
      });
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId
    });

    await Payment.update(
      { status: 'refunded', refundId: refund.id, refundAmount: payment.amount },
      { where: { orderId } }
    );

    await Order.update(
      { paymentStatus: 'refunded', status: 'refunded' },
      { where: { id: orderId } }
    );

    res.status(200).json({
      success: true,
      message: 'Remboursement effectué !'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};