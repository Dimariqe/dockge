import { Knex } from "knex";

/**
 * Run in 2024-01-01
 * Create image_cache table for caching Docker Registry API responses
 */
export async function up(knex: Knex): Promise<void> {
    return knex.schema.createTable("image_cache", (table) => {
        table.increments("id").primary();
        table.string("image_name", 255).notNullable().unique();
        table.string("digest", 255);
        table.integer("last_checked"); // Unix timestamp
        table.integer("status").defaultTo(0);
        table.text("error_message");
        table.timestamps(true, true);
        
        table.index("image_name");
        table.index("last_checked");
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTableIfExists("image_cache");
}
