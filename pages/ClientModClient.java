package com.example.tumod; // Asegúrate que el paquete coincida con el tuyo

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import org.lwjgl.glfw.GLFW;

public class ExampleModClient implements ClientModInitializer {

    // Declaramos la variable para nuestra tecla
    private static KeyBinding leerKey;

    @Override
    public void onInitializeClient() {
        
        // 1. REGISTRAR LA TECLA
        // Definimos que la tecla por defecto sea la 'L' (GLFW.GLFW_KEY_L)
        leerKey = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.tumod.leer", // ID de traducción (para el menú de controles)
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_L, // La tecla física
            "category.tumod.educativo" // Categoría en el menú de controles
        ));

        // 2. ESCUCHAR EL EVENTO (GAME LOOP)
        // Esto se ejecuta en cada "tick" (20 veces por segundo) del cliente
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            
            // Verificamos si la tecla fue presionada en este instante
            while (leerKey.wasPressed()) {
                
                // 3. RAYCASTING (DETECTAR QUÉ MIRA EL JUGADOR)
                // 'crosshairTarget' es lo que el jugador tiene en la mira
                HitResult hit = client.crosshairTarget;

                // Verificamos que esté mirando un bloque y no al aire o una entidad
                if (hit != null && hit.getType() == HitResult.Type.BLOCK) {
                    
                    // Convertimos el resultado a BlockHitResult para obtener datos del bloque
                    BlockHitResult blockHit = (BlockHitResult) hit;
                    
                    // Obtenemos el bloque del mundo
                    var bloque = client.world.getBlockState(blockHit.getBlockPos()).getBlock();
                    
                    // Obtenemos el nombre traducido del bloque (Ej: "Césped")
                    String nombreBloque = bloque.getName().getString();

                    // 4. FEEDBACK (MENSAJE EN CHAT)
                    client.player.sendMessage(Text.literal("§a[MOD LECTURA]§f ¡Vamos a escribir: " + nombreBloque + "!"), false);
                    
                    // AQUÍ LUEGO ABRIREMOS TU GUI (PANTALLA DE ESCRITURA)
                    // client.setScreen(new PantallaLectura(nombreBloque));
                    
                } else {
                    client.player.sendMessage(Text.literal("§cNo estás mirando ningún bloque."), true);
                }
            }
        });
    }
}