/**
 * Rota raiz — redireciona direto para a primeira aba. Existe só para o
 * deep link inicial do Expo Router ter destino.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  return <Redirect href="/(tabs)/rotacao" />;
}
