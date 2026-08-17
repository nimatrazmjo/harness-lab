import { Module } from "@nestjs/common";
import { Icd10Controller } from "./icd10.controller";
import { Icd10Repository } from "./icd10.repository";
import { Icd10Service } from "./icd10.service";

@Module({
  controllers: [Icd10Controller],
  providers: [Icd10Service, Icd10Repository],
  exports: [Icd10Service, Icd10Repository],
})
export class Icd10Module {}
