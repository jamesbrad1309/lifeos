import { Body, Controller, Get, HttpCode, Param, Post, Query } from "@nestjs/common";
import { ZodValidationPipe } from "#common/http/zod-validation.pipe";
import { CategoriesService } from "#finance/categories.service";
import {
  type CreateCategoryInput,
  type DismissPresetSuggestionInput,
  createCategorySchema,
  dismissPresetSuggestionSchema,
} from "#finance/dto/category.dto";

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /**
   * `GET /categories`: the active ones users pick from.
   * `GET /categories?ids=a,b`: batch lookup by id for the BFF's DataLoader,
   * archived and system ones included.
   */
  @Get()
  list(@Query("ids") ids?: string) {
    if (ids !== undefined) return this.categories.findByIds(ids.split(",").filter(Boolean));
    return this.categories.list();
  }

  @Post()
  create(@Body(new ZodValidationPipe(createCategorySchema)) input: CreateCategoryInput) {
    return this.categories.create(input);
  }

  @Post(":id/dismiss-preset-suggestion")
  @HttpCode(204)
  async dismissPresetSuggestion(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(dismissPresetSuggestionSchema)) input: DismissPresetSuggestionInput,
  ): Promise<void> {
    await this.categories.dismissPresetSuggestion(id, input.key);
  }
}
