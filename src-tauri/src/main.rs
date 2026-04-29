// Empêche l'ouverture d'une fenêtre console en production Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    agr_tactical_board_lib::run()
}
