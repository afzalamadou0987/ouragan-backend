const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendPushNotification = async (tokens, title, body, data = {}) => {
  try {
    const tokenList = Array.isArray(tokens) ? tokens : [tokens];
    const validTokens = tokenList.filter(t => t && Expo.isExpoPushToken(t));
    if (validTokens.length === 0) return;
    const messages = validTokens.map(token => ({
      to: token, sound: 'default', title, body, data, badge: 1,
    }));
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        await expo.sendPushNotificationsAsync(chunk);
      } catch (err) {
        console.error('Push chunk error:', err);
      }
    }
  } catch (err) {
    console.error('sendPushNotification error:', err);
  }
};

const notifyOrderStatusChanged = async (user, order, newStatus) => {
  if (!user?.pushToken) return;
  const labels = {
    pending: 'En attente de confirmation',
    confirmed: 'Confirmée ✓',
    processing: 'En cours de préparation',
    shipped: 'Expédiée 🚚',
    delivered: 'Livrée ! 🎉',
    cancelled: 'Annulée',
  };
  await sendPushNotification(
    user.pushToken,
    `Commande ${order.orderNumber}`,
    `Statut mis à jour : ${labels[newStatus] || newStatus}`,
    { type: 'ORDER_STATUS', orderId: order.id, orderNumber: order.orderNumber, status: newStatus }
  );
};

const notifyOrderDelivered = async (user, order) => {
  if (!user?.pushToken) return;
  await sendPushNotification(
    user.pushToken,
    '🎉 Commande livrée !',
    `Votre commande ${order.orderNumber} a bien été livrée. Merci pour votre confiance !`,
    { type: 'ORDER_DELIVERED', orderId: order.id, orderNumber: order.orderNumber }
  );
};

const notifyNewOrder = async (adminTokens, order) => {
  if (!adminTokens?.length) return;
  await sendPushNotification(
    adminTokens,
    '🛒 Nouvelle commande !',
    `Commande ${order.orderNumber} — ${Number(order.totalAmount).toLocaleString('fr-FR')} FCFA`,
    { type: 'NEW_ORDER', orderId: order.id, orderNumber: order.orderNumber }
  );
};

module.exports = { sendPushNotification, notifyOrderStatusChanged, notifyOrderDelivered, notifyNewOrder };